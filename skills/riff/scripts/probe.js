// riff probe: measures how a page FEELS — its section rhythm, hero type, nav, and motion.
// Runs inside a browser on an already-open page. Used by `extract.mjs --browser`, or
// paste the whole file into any browser tool's JavaScript console / eval.
// It scrolls the page once (then returns to where it was), reads computed styles, and
// returns JSON. No network requests, no data leaves the page.
(async () => {
  const VERSION = '0.2.0';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const doc = document.documentElement;
  const vw = innerWidth;
  const vh = innerHeight;
  const startY = scrollY;
  const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
  const px = (v) => parseFloat(v) || 0;

  const label = (el) => {
    const cls = (typeof el.className === 'string' ? el.className : el.className?.baseVal || '')
      .trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    const text = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '')
      .trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
  };

  const isTransparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const bgOf = (el) => {
    for (let n = el; n && n !== doc; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none' && !cs.backgroundImage.includes('data:')) return { color: cs.backgroundColor, image: true };
      if (!isTransparent(cs.backgroundColor)) return { color: cs.backgroundColor, image: false };
    }
    return { color: getComputedStyle(document.body).backgroundColor, image: false };
  };
  const luminance = (rgb) => {
    const m = String(rgb).match(/[\d.]+/g);
    if (!m) return 1;
    const [r, g, b] = m.slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return round(0.2126 * r + 0.7152 * g + 0.0722 * b, 3);
  };

  // ---- libraries ----
  const scriptSrcs = [...document.scripts].map((s) => s.src).join(' ');
  const libs = Object.fromEntries(Object.entries({
    gsap: !!window.gsap || /gsap/i.test(scriptSrcs),
    scrollTrigger: !!window.ScrollTrigger || /scrolltrigger/i.test(scriptSrcs),
    lenis: !!(window.Lenis || window.lenis) || doc.classList.contains('lenis') || /lenis/i.test(scriptSrcs),
    locomotive: !!document.querySelector('[data-scroll-container]') || /locomotive/i.test(scriptSrcs),
    framerMotion: !!document.querySelector('[data-framer-appear-id],[data-framer-component-type]') || /framer-motion|framerusercontent/i.test(scriptSrcs),
    three: !!window.THREE || /three(\.module)?(\.min)?\.js/i.test(scriptSrcs),
    lottie: !!(window.lottie || window.bodymovin) || !!document.querySelector('lottie-player,dotlottie-player') || /lottie/i.test(scriptSrcs),
    swiper: !!window.Swiper || !!document.querySelector('.swiper'),
    aos: !!window.AOS || !!document.querySelector('[data-aos]'),
    webflowInteractions: !!document.querySelector('[data-w-id]'),
  }).filter(([, v]) => v));

  // ---- start from the top ----
  const prevBehavior = doc.style.scrollBehavior;
  doc.style.scrollBehavior = 'auto';
  scrollTo(0, 0);
  await sleep(500);

  // ---- nav ----
  let nav = null;
  const navEl = [...document.querySelectorAll('header, nav, [role="navigation"]')]
    .find((el) => { const r = el.getBoundingClientRect(); return r.top < 80 && r.width > vw * 0.5 && r.height > 20 && r.height < 200; });
  if (navEl) {
    let pos = 'static';
    for (let n = navEl; n && n !== doc; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') { pos = p; break; }
    }
    const cs = getComputedStyle(navEl);
    const parentCs = getComputedStyle(navEl.parentElement || navEl);
    nav = {
      position: pos,
      height: round(navEl.getBoundingClientRect().height),
      blur: /blur/.test(cs.backdropFilter || cs.webkitBackdropFilter || '') || /blur/.test(parentCs.backdropFilter || ''),
      background: bgOf(navEl).color,
      links: navEl.querySelectorAll('a').length,
    };
  }

  // ---- hero type: the biggest text in the first viewport ----
  let hero = null;
  for (const el of document.querySelectorAll('h1, h2, h3, p, span, div, a')) {
    const ownText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
    if (!ownText) continue;
    const r = el.getBoundingClientRect();
    if (r.top > vh || r.bottom < 0 || r.width === 0) continue;
    const cs = getComputedStyle(el);
    const size = px(cs.fontSize);
    if (!hero || size > hero.size) {
      hero = {
        size, weight: cs.fontWeight, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
        family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), align: cs.textAlign,
        color: cs.color, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
      };
    }
  }

  // ---- sections: descend until the page splits into full-width blocks ----
  let container = document.querySelector('main') || document.body;
  for (let depth = 0; depth < 8; depth++) {
    const blocks = [...container.children].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width >= vw * 0.85 && r.height >= vh * 0.15;
    });
    if (blocks.length >= 3) break;
    const big = [...container.children].find((c) => c.getBoundingClientRect().height > container.getBoundingClientRect().height * 0.7);
    if (!big) break;
    container = big;
  }
  const sectionEls = [...container.children].filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width >= vw * 0.85 && r.height >= vh * 0.15 && getComputedStyle(c).display !== 'none';
  }).slice(0, 40);

  const sections = sectionEls.map((el, index) => {
    const r = el.getBoundingClientRect();
    const area = Math.max(1, r.width * r.height);
    const bg = bgOf(el);
    let headingSize = 0, headingAlign = null;
    for (const h of el.querySelectorAll('h1, h2, h3, [class*="headline"], [class*="title"]')) {
      const cs = getComputedStyle(h);
      if (px(cs.fontSize) > headingSize) { headingSize = px(cs.fontSize); headingAlign = cs.textAlign; }
    }
    const media = [...el.querySelectorAll('img, picture, video, canvas, svg')].filter((m) => {
      const mr = m.getBoundingClientRect();
      return mr.width * mr.height >= area * 0.12;
    });
    const firstText = [...el.querySelectorAll('h1, h2, h3, p')].find((t) => t.getBoundingClientRect().height > 0);
    const kids = [...el.querySelectorAll(':scope > *, :scope > * > *')].filter((k) => {
      const kr = k.getBoundingClientRect();
      return kr.width > 120 && kr.width < r.width * 0.6 && kr.height > 80;
    });
    const lefts = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().left / 20)));
    return {
      index,
      label: label(el),
      top: round(r.top + scrollY),
      heightVh: round(r.height / vh, 2),
      background: bg.color,
      backgroundImage: bg.image,
      dark: luminance(bg.color) < 0.2,
      headingSize: round(headingSize),
      headingAlign,
      largeMedia: media.length,
      video: el.querySelectorAll('video').length,
      columns: Math.min(lefts.size || 1, 6),
      paddingTop: firstText ? round(firstText.getBoundingClientRect().top - r.top) : null,
      sticky: [...el.querySelectorAll('*')].some((n) => getComputedStyle(n).position === 'sticky'),
    };
  });
  const sectionAt = (docTop) => {
    const s = sections.find((x, i) => docTop >= x.top && (i === sections.length - 1 || docTop < sections[i + 1].top));
    return s ? s.index : null;
  };

  // ---- motion: sample candidates at many scroll depths ----
  const cands = [...document.body.querySelectorAll('*')].slice(0, 6000).filter((el) => {
    if (/^(SCRIPT|STYLE|LINK|META|BR|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 40 && r.height >= 20;
  }).slice(0, 1800);

  const read = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return [cs.opacity, cs.transform, cs.clipPath, cs.filter, r.top, r.height, cs.position];
  };

  // Ambient motion (carousels, loops) changes without scrolling: sample twice at rest.
  const restA = cands.map(read);
  await sleep(900);
  const restB = cands.map(read);
  const ambient = new Set();
  cands.forEach((_, i) => {
    const a = restA[i], b = restB[i];
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) ambient.add(i);
  });

  const maxY = Math.max(0, doc.scrollHeight - vh);
  // ~3 samples per screen: dense enough to see pinned sections, short enough to finish in < 1 min.
  const steps = Math.min(90, Math.max(12, Math.round((doc.scrollHeight / vh) * 3)));
  const samples = [];
  for (let s = 0; s <= steps; s++) {
    scrollTo(0, Math.round((maxY * s) / steps));
    await sleep(260);
    samples.push({ y: scrollY, row: cands.map(read) });
  }

  const parseT = (t) => {
    const m = String(t).match(/matrix(3d)?\(([^)]+)\)/);
    if (!m) return { x: 0, y: 0, s: 1 };
    const v = m[2].split(',').map(Number);
    return m[1] ? { x: v[12], y: v[13], s: Math.hypot(v[0], v[1]) } : { x: v[4], y: v[5], s: Math.hypot(v[0], v[1]) };
  };
  const blurOf = (f) => { const m = String(f).match(/blur\(([\d.]+)px\)/); return m ? Number(m[1]) : 0; };
  const range = (arr) => [round(Math.min(...arr), 2), round(Math.max(...arr), 2)];

  const items = [];
  const pinned = [];
  cands.forEach((el, i) => {
    if (ambient.has(i)) return;
    const near = samples.filter(({ row }) => row[i][4] < vh * 1.2 && row[i][4] + row[i][5] > -vh * 0.2);
    if (near.length >= 2) {
      const keys = new Set(near.map(({ row }) => row[i].slice(0, 4).join('|')));
      if (keys.size >= 2) {
        const ts = near.map(({ row }) => parseT(row[i][1]));
        const ops = near.map(({ row }) => Number(row[i][0]));
        const props = [];
        const r = {};
        if (new Set(ops).size > 1) { props.push('opacity'); r.opacity = range(ops); }
        const ys = ts.map((t) => t.y), xs = ts.map((t) => t.x), ss = ts.map((t) => t.s);
        if (Math.max(...ys) - Math.min(...ys) > 4) { props.push('y'); r.y = range(ys); }
        if (Math.max(...xs) - Math.min(...xs) > 4) { props.push('x'); r.x = range(xs); }
        if (Math.max(...ss) - Math.min(...ss) > 0.02) { props.push('scale'); r.scale = range(ss); }
        if (new Set(near.map(({ row }) => row[i][2])).size > 1) props.push('clip');
        const blurs = near.map(({ row }) => blurOf(row[i][3]));
        if (Math.max(...blurs) > 0 && new Set(blurs).size > 1) { props.push('blur'); r.blur = range(blurs); }
        if (props.length) {
          const cs = getComputedStyle(el);
          const dur = cs.transitionDuration.split(',')[0].trim();
          items.push({
            el: label(el),
            kind: keys.size >= 4 ? 'scrub' : 'reveal',
            props,
            range: r,
            timing: dur && dur !== '0s' ? `${dur} ${cs.transitionTimingFunction.split(/,(?![^(]*\))/)[0].trim()}` : null,
            section: sectionAt(near[0].row[i][4] + near[0].y),
          });
        }
      }
    }
    // Pinned: viewport position stays put for ≥ 3 consecutive samples while the page scrolls.
    if (samples[0].row[i][6] === 'fixed' || samples[0].row[i][5] < vh * 0.3) return;
    let run = 1, best = 1;
    for (let s = 1; s < samples.length; s++) {
      const cur = samples[s].row[i], prev = samples[s - 1].row[i];
      const still = Math.abs(cur[4] - prev[4]) < 2 && samples[s].y !== samples[s - 1].y;
      const visible = cur[4] < vh && cur[4] + cur[5] > 0;
      run = still && visible ? run + 1 : 1;
      best = Math.max(best, run);
    }
    if (best >= 3 && best < samples.length) {
      pinned.push({ el, info: { el: label(el), screens: round(((best - 1) * (maxY / steps)) / vh, 1) } });
    }
  });
  // Keep only the outermost element of each nested pinned group.
  const pinnedOuter = pinned.filter((p) => !pinned.some((q) => q !== p && q.el.contains(p.el))).map((p) => p.info);

  // The nav you feel is the one still on screen after scrolling (e.g. a sticky product
  // nav under a global nav that scrolls away), so look again 1.5 screens down.
  scrollTo(0, Math.min(maxY, Math.round(vh * 1.5)));
  await sleep(400);
  const hasBlur = (n) => /blur/.test(getComputedStyle(n).backdropFilter || getComputedStyle(n).webkitBackdropFilter || '');
  for (const hit of document.elementsFromPoint(vw / 2, 8)) {
    let found = null;
    for (let n = hit; n && n !== doc && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p !== 'fixed' && p !== 'sticky') continue;
      const r = n.getBoundingClientRect();
      if (r.top <= 4 && r.height >= 24 && r.height <= 160 && r.width >= vw * 0.5) { found = n; break; }
    }
    if (found) {
      nav = {
        position: getComputedStyle(found).position,
        height: round(found.getBoundingClientRect().height),
        blur: hasBlur(found) || [...found.querySelectorAll('*')].slice(0, 40).some(hasBlur),
        background: bgOf(found).color,
        links: found.querySelectorAll('a').length,
        persistsOnScroll: true,
      };
      break;
    }
  }
  if (nav && !nav.persistsOnScroll) nav.persistsOnScroll = false;

  const anims = document.getAnimations ? document.getAnimations() : [];
  const animations = [...new Set(anims.map((a) => a.animationName || a.transitionProperty || a.id || 'waapi'))].slice(0, 20);
  const infinite = anims.filter((a) => a.effect?.getTiming?.().iterations === Infinity).length;

  scrollTo(0, startY);
  doc.style.scrollBehavior = prevBehavior;

  const count = (k) => items.filter((x) => x.kind === k).length;
  return {
    tool: 'riff-probe',
    version: VERSION,
    url: location.href,
    viewport: { w: vw, h: vh },
    pageHeightVh: round(doc.scrollHeight / vh, 1),
    libs: Object.keys(libs),
    nav,
    hero,
    sections,
    motion: {
      summary: {
        reveal: count('reveal'),
        scrub: count('scrub'),
        pinned: pinnedOuter.length,
        stickySections: sections.filter((s) => s.sticky).length,
        ambient: ambient.size,
        runningAnimations: anims.length,
        infiniteAnimations: infinite,
        videos: document.querySelectorAll('video').length,
        canvases: document.querySelectorAll('canvas').length,
      },
      items: items.slice(0, 60),
      pinned: pinnedOuter.slice(0, 12),
      animations,
    },
  };
})();

// riff motion: a tiny, dependency-free scroll-motion runtime (MIT).
// Copy motion.js + motion.css into the project and call initMotion() once the DOM is ready.
//
//   data-reveal="up|down|left|right|fade|scale|blur|clip"
//       One-time entrance when the element scrolls into view.
//   data-reveal-delay="120"            Delay in ms for one element.
//   data-reveal-stagger="80"           On a parent: its [data-reveal] children enter 80ms apart.
//
//   data-scrub="opacity:0,1; y:80,0; scale:.9,1@0,.6"
//       Values follow scroll progress. Props: x, y (px), scale, rotate (deg), opacity,
//       radius (px), blur (px), clip (% inset). "@a,b" limits a track to part of the progress.
//       Progress is 0 when the element's top enters the viewport and 1 when its bottom leaves.
//
//   data-pin="3"
//       A section 3 screens tall whose first child sticks to the viewport while you scroll
//       through it. [data-scrub] elements inside use the section's progress instead of their own.
//
//   data-progress
//       Exposes progress as the CSS variable --progress (0 → 1). [data-pin] always gets it.
//
// Respects prefers-reduced-motion: reveals show immediately, scrubs stay in their natural state.

const TRANSFORM_PROPS = new Set(['x', 'y', 'scale', 'rotate']);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function parseScrub(spec) {
  return spec.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^([a-z]+)\s*:\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)(?:\s*@\s*([\d.]+)\s*,\s*([\d.]+))?$/i);
    if (!m) {
      console.warn(`riff motion: can't read data-scrub track "${part}"`);
      return null;
    }
    return {
      prop: m[1].toLowerCase(),
      from: Number(m[2]),
      to: Number(m[3]),
      start: m[4] != null ? Number(m[4]) : 0,
      end: m[5] != null ? Number(m[5]) : 1,
    };
  }).filter(Boolean);
}

function applyTracks(el, tracks, progress) {
  const t = { x: 0, y: 0, scale: 1, rotate: 0 };
  let hasTransform = false;
  let radius = 0;
  for (const track of tracks) {
    const local = clamp((progress - track.start) / Math.max(1e-6, track.end - track.start));
    const value = track.from + (track.to - track.from) * local;
    if (TRANSFORM_PROPS.has(track.prop)) {
      t[track.prop] = value;
      hasTransform = true;
    } else if (track.prop === 'opacity') {
      el.style.opacity = String(value);
    } else if (track.prop === 'radius') {
      radius = value;
      el.style.borderRadius = `${value}px`;
    } else if (track.prop === 'blur') {
      el.style.filter = `blur(${value}px)`;
    } else if (track.prop === 'clip') {
      el.style.clipPath = `inset(${value}% ${value}% ${value}% ${value}% round ${radius}px)`;
    }
  }
  if (hasTransform) {
    el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale}) rotate(${t.rotate}deg)`;
  }
}

// Progress of an element travelling through the viewport.
function travelProgress(rect, vh) {
  return clamp((vh - rect.top) / (vh + rect.height));
}

// Progress through a pinned section: 0 when it reaches the top, 1 when it is about to leave.
function pinProgress(rect, vh) {
  return clamp(-rect.top / Math.max(1, rect.height - vh));
}

export function initMotion(root = document) {
  document.documentElement.classList.add('riff-motion');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- reveals ----
  root.querySelectorAll('[data-reveal-stagger]').forEach((parent) => {
    const step = Number(parent.getAttribute('data-reveal-stagger')) || 80;
    parent.querySelectorAll('[data-reveal]').forEach((child, i) => {
      if (!child.hasAttribute('data-reveal-delay')) child.style.transitionDelay = `${i * step}ms`;
    });
  });
  root.querySelectorAll('[data-reveal-delay]').forEach((el) => {
    el.style.transitionDelay = `${Number(el.getAttribute('data-reveal-delay')) || 0}ms`;
  });
  const reveals = [...root.querySelectorAll('[data-reveal]')];
  let observer = null;
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((el) => observer.observe(el));
  }

  // ---- pins ----
  const pins = [...root.querySelectorAll('[data-pin]')];
  pins.forEach((pin) => {
    const screens = Number(pin.getAttribute('data-pin')) || 2;
    pin.style.height = `${screens * 100}vh`;
    pin.firstElementChild?.classList.add('riff-pin-stage');
  });

  if (reduce) return () => observer?.disconnect();

  // ---- scrubs and progress ----
  const scrubs = [...root.querySelectorAll('[data-scrub]')].map((el) => ({
    el,
    tracks: parseScrub(el.getAttribute('data-scrub') || ''),
    pin: el.closest('[data-pin]'),
  }));
  const progressEls = [...root.querySelectorAll('[data-progress]')];

  let queued = false;
  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    const pinProgressOf = new Map();
    for (const pin of pins) {
      const p = pinProgress(pin.getBoundingClientRect(), vh);
      pinProgressOf.set(pin, p);
      pin.style.setProperty('--progress', p.toFixed(4));
    }
    for (const el of progressEls) {
      if (!pinProgressOf.has(el)) el.style.setProperty('--progress', travelProgress(el.getBoundingClientRect(), vh).toFixed(4));
    }
    for (const s of scrubs) {
      if (s.pin) {
        applyTracks(s.el, s.tracks, pinProgressOf.get(s.pin) ?? 0);
        continue;
      }
      const rect = s.el.getBoundingClientRect();
      if (rect.bottom < -vh || rect.top > vh * 2) continue; // far off-screen
      applyTracks(s.el, s.tracks, travelProgress(rect, vh));
    }
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();

  return () => {
    observer?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}

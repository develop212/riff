#!/usr/bin/env node
// riff extractor: captures the design data of ONE public page for local analysis.
// Zero dependencies (Node 18+). Optional --browser mode uses the project's Playwright.
//
//   node extract.mjs <url> [--out .riff] [--browser] [--own-site]
//
// Honours robots.txt and TDM reservations (tdm-reservation header/meta, tdmrep.json).
// Makes at most MAX_REQUESTS requests in static mode. Never crawls.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { COLOR_RE, parseColor, toHex, toOklch, deltaE, isNeutral } from './lib/color.mjs';
import { openChrome } from './lib/chrome.mjs';

const VERSION = '0.2.0';
const REPO = 'https://github.com/develop212/riff';
const UA = `Mozilla/5.0 (compatible; riff/${VERSION}; +${REPO})`;
const ROBOTS_TOKEN = 'riff';
const MAX_REQUESTS = 30;
const MAX_STYLESHEETS = 24;
const MAX_HTML_BYTES = 3_000_000;
const MAX_CSS_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;

const OPEN_FONT_HOSTS = [
  ['fonts.gstatic.com', 'google'],
  ['fonts.googleapis.com', 'google'],
  ['fonts.bunny.net', 'bunny'],
  ['cdn.jsdelivr.net/fontsource', 'fontsource'],
  ['cdn.jsdelivr.net/npm/@fontsource', 'fontsource'],
  ['api.fontshare.com', 'fontshare'],
];
const LICENSED_FONT_HOSTS = [
  ['use.typekit.net', 'adobe'],
  ['p.typekit.net', 'adobe'],
  ['fast.fonts.net', 'monotype'],
  ['cloud.typography.com', 'hoefler'],
];
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif',
  'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
  'roboto', 'helvetica', 'arial', 'emoji', 'math', 'inherit', 'initial', 'unset',
  'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji',
]);
// Open-licence (OFL/Apache) families that sites commonly self-host, e.g. via next/font.
// Compared after squashing case, spaces, dashes and a "variable" suffix.
const KNOWN_OPEN_FAMILIES = new Set([
  'inter', 'intertight', 'geist', 'geistsans', 'geistmono', 'roboto', 'robotomono', 'opensans', 'lato',
  'montserrat', 'poppins', 'dmsans', 'dmmono', 'dmserifdisplay', 'manrope', 'plusjakartasans', 'figtree',
  'outfit', 'spacegrotesk', 'spacemono', 'ibmplexsans', 'ibmplexmono', 'ibmplexserif', 'jetbrainsmono',
  'sourcesans3', 'sourcesanspro', 'sourceserif4', 'sourceserifpro', 'sourcecodepro', 'fraunces',
  'playfairdisplay', 'lora', 'merriweather', 'worksans', 'nunito', 'nunitosans', 'raleway', 'rubik',
  'karla', 'mulish', 'archivo', 'sora', 'urbanist', 'lexend', 'instrumentsans', 'instrumentserif',
  'newsreader', 'ebgaramond', 'cormorantgaramond', 'jost', 'hankengrotesk', 'schibstedgrotesk',
  'publicsans', 'notosans', 'notoserif', 'firacode', 'firasans', 'bricolagegrotesque', 'onest',
  'redhatdisplay', 'redhattext', 'albertsans', 'literata', 'arimo', 'barlow', 'cabin',
]);
// Commercial or brand-restricted families, recognised by name even when their @font-face
// isn't in the fetched CSS (some sites load fonts from separate font services).
const KNOWN_PROPRIETARY = /^(sf pro|sf mono|sf compact|new york|helvetica neue|neue haas|s[oö]hne|circular|gt [a-z]+|graphik|proxima nova|avenir|gotham|futura|gilroy|tiempos|canela|freight|berkeley mono|operator mono|brandon|aktiv grotesk|neue montreal|pp [a-z]+|untitled sans|founders grotesk|calibre|apercu|maison neue|basis grotesque|whyte)/i;

const squashFamily = (f) => f.toLowerCase().replace(/^_+|_[0-9a-f]{4,}$/g, '').replace(/[\s_-]+/g, '')
  .replace(/fallback$/, '').replace(/(variable|var)$/, '');

const GENERIC_BRAND_WORDS = new Set([
  'home', 'homepage', 'welcome', 'official', 'site', 'website', 'the', 'and', 'for', 'with',
  'page', 'online', 'app', 'www', 'inc', 'llc', 'ltd', 'login', 'sign', 'best', 'logo',
]);

// ---------- args ----------

function parseArgs(argv) {
  const opts = { out: '.riff', browser: false, ownSite: false, url: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--browser') opts.browser = true;
    else if (a === '--static') opts.static = true;
    else if (a === '--experience') opts.experience = argv[++i];
    else if (a === '--own-site') opts.ownSite = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!a.startsWith('--')) opts.url = a;
    else fail(`Unknown option ${a}`, 2);
  }
  return opts;
}

function fail(msg, code = 1) {
  console.error(`riff: ${msg}`);
  process.exit(code);
}

// ---------- fetching ----------

let requestCount = 0;

async function get(url, { maxBytes = MAX_CSS_BYTES, accept = '*/*' } = {}) {
  if (requestCount >= MAX_REQUESTS) return null;
  requestCount++;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept, 'accept-language': 'en' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      ok: res.ok,
      status: res.status,
      url: res.url || url,
      headers: res.headers,
      text: buf.subarray(0, maxBytes).toString('utf8'),
    };
  } catch (err) {
    return { ok: false, status: 0, url, headers: new Headers(), text: '', error: err.message };
  }
}

// ---------- robots.txt / TDM ----------

function robotsPatternMatches(pattern, target) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(target);
}

export function robotsAllows(txt, token, target) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow') && val !== '') {
        cur.rules.push({ allow: key === 'allow', path: val });
      }
    }
  }
  const specific = groups.filter((g) => g.agents.includes(token));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const g of applicable) {
    for (const r of g.rules) {
      if (!robotsPatternMatches(r.path, target)) continue;
      const longer = !best || r.path.length > best.path.length;
      const tieAllow = best && r.path.length === best.path.length && r.allow;
      if (longer || tieAllow) best = r;
    }
  }
  return best ? best.allow : true;
}

async function checkAccess(url) {
  const u = new URL(url);
  const target = u.pathname + u.search;
  const robots = await get(new URL('/robots.txt', u).href, { maxBytes: 500_000, accept: 'text/plain' });
  if (robots?.ok && !robotsAllows(robots.text, ROBOTS_TOKEN, target)) {
    return { allowed: false, reason: `robots.txt on ${u.host} disallows ${target}` };
  }
  const tdm = await get(new URL('/.well-known/tdmrep.json', u).href, { maxBytes: 200_000, accept: 'application/json' });
  if (tdm?.ok) {
    try {
      const rules = JSON.parse(tdm.text);
      for (const r of Array.isArray(rules) ? rules : []) {
        if (Number(r['tdm-reservation']) === 1 && robotsPatternMatches(r.location || '/', target)) {
          return { allowed: false, reason: `${u.host} reserves text-and-data-mining rights (tdmrep.json)` };
        }
      }
    } catch {
      // Not JSON (many sites answer with an HTML page and status 200). Ignore.
    }
  }
  return { allowed: true };
}

function tdmReservedInPage(page) {
  if (page.headers.get('tdm-reservation')?.trim() === '1') return 'tdm-reservation HTTP header';
  const meta = page.text.match(/<meta[^>]+name\s*=\s*["']tdm-reservation["'][^>]*>/i);
  if (meta && /content\s*=\s*["']\s*1\s*["']/i.test(meta[0])) return 'tdm-reservation meta tag';
  return null;
}

// Tiny pages that only forward the visitor elsewhere (meta refresh, JS location, or an
// auto-submitting form, e.g. a regional domain switch). riff never submits forms, so it
// reports the destination instead of following it.
function redirectTarget(html, base) {
  if (html.length > 8000 || /<link[^>]+stylesheet/i.test(html)) return null;
  const found =
    html.match(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"'>\s]+)/i)?.[1] ||
    html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1] ||
    (/\.submit\(\)/.test(html) ? html.match(/<form[^>]+action\s*=\s*["']([^"']+)["']/i)?.[1] : null);
  if (!found) return null;
  try { return new URL(decodeEntities(found), base).origin + '/'; } catch { return null; }
}

// ---------- counting helpers ----------

class Counter {
  constructor() { this.map = new Map(); }
  add(key, n = 1) { if (key !== '' && key != null) this.map.set(key, (this.map.get(key) || 0) + n); }
  top(limit = 20) {
    return [...this.map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }
}

function toPx(token) {
  const m = String(token).trim().match(/^(-?\d*\.?\d+)(px|rem|em)?$/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'rem' || unit === 'em') return Math.round(v * 16 * 100) / 100;
  if (unit === 'px' || v === 0) return v;
  return null;
}

function pxTokens(value) {
  return (value.match(/-?\d*\.?\d+(?:px|rem|em)\b/gi) || []).map(toPx).filter((v) => v != null);
}

function msTokens(value) {
  return (value.match(/\d*\.?\d+m?s\b/gi) || []).map((t) =>
    t.toLowerCase().endsWith('ms') ? parseFloat(t) : Math.round(parseFloat(t) * 1000));
}

function firstFamily(value) {
  return value.split(',')[0].trim().replace(/\s*!important$/, '').replace(/^["']|["']$/g, '').trim();
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

function resolve(href, base) {
  if (!href) return null;
  try { return new URL(decodeEntities(href), base).href; } catch { return null; }
}

function fontHost(url) {
  if (!url) return 'inline';
  for (const [h, name] of OPEN_FONT_HOSTS) if (url.includes(h)) return name;
  for (const [h, name] of LICENSED_FONT_HOSTS) if (url.includes(h)) return name;
  return 'self';
}

// ---------- the accumulator ----------

function newAcc() {
  return {
    colors: new Map(), // hex -> { count, roles: Counter }
    families: new Counter(),
    stacks: new Counter(),
    sizes: new Counter(),
    weights: new Counter(),
    lineHeights: new Counter(),
    tracking: new Counter(),
    radius: new Counter(),
    shadows: new Counter(),
    spacing: new Counter(),
    durations: new Counter(),
    easings: new Counter(),
    maxWidths: new Counter(),
    breakpoints: new Counter(),
    customProps: new Map(),
    vars: new Map(), // every custom property, first definition wins (used to resolve var())
    decls: [], // [prop, value] collected from CSS, analysed after all sheets load
    // Motion and interaction signals readable without a browser.
    signals: { sticky: 0, scrollTimelines: 0, scrollSnap: 0, backdropBlur: 0, reducedMotion: 0, keyframes: new Counter(), hover: new Counter() },
    faces: [],
    assets: new Map(), // url -> { url, name, logo, source }
  };
}

function addColor(acc, raw, role) {
  const c = parseColor(raw);
  if (!c || c.a < 0.1) return;
  const hex = toHex(c);
  if (!acc.colors.has(hex)) acc.colors.set(hex, { count: 0, roles: new Counter() });
  const entry = acc.colors.get(hex);
  entry.count++;
  entry.roles.add(role);
}

function colorRole(prop) {
  if (prop === 'color') return 'text';
  if (prop.startsWith('background')) return 'background';
  if (prop.startsWith('border') || prop.startsWith('outline')) return 'border';
  if (prop === 'fill' || prop === 'stroke') return 'svg';
  if (prop.includes('shadow')) return 'shadow';
  if (prop.startsWith('--')) return 'variable';
  return 'other';
}

function addAsset(acc, url, source, hint = '') {
  if (!url || url.startsWith('data:')) return;
  const clean = url.split(/[?#]/)[0];
  if (!/\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|lottie|glb|gltf|ico)$/i.test(clean)) return;
  if (acc.assets.has(clean)) return;
  let name = clean.split('/').pop() || '';
  try { name = decodeURIComponent(name); } catch { /* keep raw */ }
  acc.assets.set(clean, { url: clean, name, logo: /logo|wordmark|brand/i.test(clean + ' ' + hint), source });
}

function analyzeDeclaration(acc, prop, value) {
  prop = prop.toLowerCase().trim();
  value = value.replace(/\s*!important\s*$/i, '').trim();
  if (!value) return;

  if (prop.startsWith('--') && acc.customProps.size < 400 && !acc.customProps.has(prop)) {
    acc.customProps.set(prop, value.slice(0, 160));
  }

  const colors = value.match(COLOR_RE);
  if (colors && (prop.startsWith('--') || /color|background|border|outline|fill|stroke|shadow|caret|accent|decoration/.test(prop))) {
    for (const c of colors) addColor(acc, c, colorRole(prop));
  }

  const sig = acc.signals;
  if (prop === 'position' && /sticky/.test(value)) sig.sticky++;
  else if (/^(animation-timeline|view-timeline|view-timeline-name|scroll-timeline|scroll-timeline-name)$/.test(prop)) sig.scrollTimelines++;
  else if (prop === 'scroll-snap-type' && value !== 'none') sig.scrollSnap++;
  else if (/backdrop-filter$/.test(prop) && /blur/.test(value)) sig.backdropBlur++;

  switch (prop) {
    case 'font-family': {
      const fam = firstFamily(value);
      if (fam && !fam.startsWith('var(')) acc.families.add(fam);
      acc.stacks.add(value.slice(0, 160));
      break;
    }
    case 'font-size':
      for (const px of pxTokens(value)) if (px > 0) acc.sizes.add(px);
      break;
    case 'font-weight':
      if (/^\d{3}$|^bold$|^normal$/.test(value)) acc.weights.add(value);
      break;
    case 'line-height':
      if (!value.includes('var(')) acc.lineHeights.add(value.slice(0, 20));
      break;
    case 'letter-spacing':
      if (!value.includes('var(')) acc.tracking.add(value.slice(0, 20));
      break;
    case 'border-radius':
      if (!value.includes('var(') && value !== 'inherit') acc.radius.add(value.replace(/\s+/g, ' ').slice(0, 40));
      break;
    case 'box-shadow':
      if (value !== 'none' && !value.includes('var(')) acc.shadows.add(value.replace(/\s+/g, ' ').slice(0, 140));
      break;
    case 'max-width':
      for (const px of pxTokens(value)) if (px >= 320) acc.maxWidths.add(px);
      break;
    case 'transition':
    case 'transition-duration':
    case 'animation':
    case 'animation-duration':
      for (const ms of msTokens(value)) if (ms > 0 && ms <= 5000) acc.durations.add(ms);
      for (const e of value.match(/cubic-bezier\([^)]*\)|ease-in-out|ease-in|ease-out|\bease\b|\blinear\b|steps\([^)]*\)/g) || []) {
        acc.easings.add(e.replace(/\s+/g, ''));
      }
      break;
    case 'transition-timing-function':
    case 'animation-timing-function':
      acc.easings.add(value.replace(/\s+/g, ''));
      break;
    default:
      if (/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(prop)) {
        for (const px of pxTokens(value)) if (px > 0) acc.spacing.add(px);
      }
  }
}

function analyzeCss(acc, css, baseUrl, sheetUrl) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const m of css.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const block = m[1];
    const family = (block.match(/font-family\s*:\s*([^;]+)/i)?.[1] || '').trim().replace(/^["']|["']$/g, '');
    const srcs = [...block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((u) => resolve(u[1], baseUrl)).filter(Boolean);
    const host = fontHost(srcs[0] || sheetUrl);
    if (family) {
      const knownOpen = KNOWN_OPEN_FAMILIES.has(squashFamily(family));
      acc.faces.push({
        family,
        weight: (block.match(/font-weight\s*:\s*([^;]+)/i)?.[1] || '').trim(),
        host,
        selfHosted: host === 'self',
        open: knownOpen || OPEN_FONT_HOSTS.some(([, n]) => n === host),
        knownOpen,
        src: srcs[0] || null,
      });
    }
  }
  css = css.replace(/@font-face\s*{[^}]*}/gi, '');

  for (const m of css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/gi)) acc.signals.keyframes.add(m[1]);
  acc.signals.reducedMotion += (css.match(/prefers-reduced-motion/gi) || []).length;
  for (const m of css.matchAll(/[^{}]*:hover[^{}]*\{([^{}]*)\}/gi)) {
    for (const p of m[1].matchAll(/(?:^|;)\s*(transform|translate|scale|box-shadow|background(?:-color)?|color|opacity|filter|text-decoration[\w-]*|border-color)\s*:/gi)) {
      acc.signals.hover.add(p[1].toLowerCase());
    }
  }

  for (const m of css.matchAll(/@media[^{]*?\(\s*(?:min|max)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)/gi)) {
    acc.breakpoints.add(m[2] === 'px' ? Number(m[1]) : Math.round(Number(m[1]) * 16));
  }

  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    addAsset(acc, resolve(m[1], baseUrl), 'css');
  }

  for (const m of css.matchAll(/(?:^|[{;\s])(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const prop = m[1].toLowerCase();
    if (prop.startsWith('--') && !acc.vars.has(prop)) acc.vars.set(prop, m[2].trim());
    acc.decls.push([prop, m[2]]);
  }
}

// Replaces var(--x, fallback) innermost-first, so nested references resolve too.
function resolveVars(value, vars) {
  for (let i = 0; i < 10 && value.includes('var('); i++) {
    const next = value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g, (_, name, fallback) =>
      vars.get(name.toLowerCase()) ?? (fallback ?? '').trim());
    if (next === value) break;
    value = next;
  }
  return value;
}

function analyzeCollected(acc) {
  for (const [prop, value] of acc.decls) analyzeDeclaration(acc, prop, resolveVars(value, acc.vars));
  acc.decls = [];
}

// ---------- HTML ----------

function analyzeHtml(acc, html, baseUrl) {
  const out = { stylesheets: [], inlineCss: [], meta: {}, headings: [], blocks: [], googleFamilies: [] };

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (attr(tag, 'rel') || '').toLowerCase();
    const abs = resolve(attr(tag, 'href'), baseUrl);
    if (!abs) continue;
    if (rel.includes('stylesheet') || (rel.includes('preload') && (attr(tag, 'as') || '') === 'style')) {
      if (abs.includes('fonts.googleapis.com')) {
        for (const f of abs.matchAll(/family=([^&:]+)/g)) out.googleFamilies.push(decodeURIComponent(f[1]).replace(/\+/g, ' '));
      }
      if (!out.stylesheets.includes(abs)) out.stylesheets.push(abs);
    }
    if (rel.includes('icon')) addAsset(acc, abs, 'favicon', 'brand');
  }

  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out.inlineCss.push(m[1]);
  for (const m of html.matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) out.inlineCss.push(`x{${decodeEntities(m[2] ?? m[3])}}`);

  const metaContent = (re) => { const t = html.match(re)?.[0]; return t ? decodeEntities(attr(t, 'content') || '') : ''; };
  out.meta.title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  out.meta.siteName = metaContent(/<meta[^>]+property\s*=\s*["']og:site_name["'][^>]*>/i);
  out.meta.appName = metaContent(/<meta[^>]+name\s*=\s*["']application-name["'][^>]*>/i);
  out.meta.themeColor = metaContent(/<meta[^>]+name\s*=\s*["']theme-color["'][^>]*>/i);
  if (out.meta.themeColor) addColor(acc, out.meta.themeColor, 'theme-color');

  const logoAlts = [];
  for (const m of html.matchAll(/<(img|source|video)\b[^>]*>/gi)) {
    const tag = m[0];
    const kind = m[1].toLowerCase();
    const alt = attr(tag, 'alt') || '';
    const hint = `${alt} ${attr(tag, 'class') || ''} ${attr(tag, 'id') || ''}`;
    for (const name of ['src', 'poster', 'data-src']) addAsset(acc, resolve(attr(tag, name), baseUrl), kind, hint);
    const srcset = attr(tag, 'srcset');
    if (srcset) addAsset(acc, resolve(srcset.split(',')[0].trim().split(/\s+/)[0], baseUrl), kind, hint);
    if (/logo/i.test(hint) && alt) logoAlts.push(decodeEntities(alt));
  }
  out.meta.logoAlts = logoAlts.slice(0, 5);

  const scriptSrcs = [...html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).join(' ');
  const inlineJs = [...html.matchAll(/<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].slice(0, 20000)).join('\n');
  const both = scriptSrcs + '\n' + inlineJs;
  const libTests = {
    gsap: /gsap/i, scrollTrigger: /scrolltrigger/i, lenis: /lenis/i, locomotive: /locomotive-scroll/i,
    framerMotion: /framer-motion|framerusercontent/i, three: /three(\.module)?(\.min)?\.js|from\s*["']three["']/i,
    lottie: /lottie|bodymovin/i, swiper: /swiper/i, aos: /\baos(\.min)?\.(js|css)\b/i, barba: /barba/i,
  };
  out.motionLibs = Object.keys(libTests).filter((k) => libTests[k].test(both));
  if (/\sdata-aos=/.test(html) && !out.motionLibs.includes('aos')) out.motionLibs.push('aos');
  out.media = {
    videos: (html.match(/<video\b/gi) || []).length,
    autoplayVideos: (html.match(/<video\b[^>]*\bautoplay/gi) || []).length,
    canvases: (html.match(/<canvas\b/gi) || []).length,
    sections: (html.match(/<section\b/gi) || []).length,
  };

  const body = html
    .replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  for (const m of body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text) out.headings.push({ level: Number(m[1]), text: text.slice(0, 200) });
  }

  const text = decodeEntities(
    body
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|div|section|article|header|footer|nav|main|a|button|td|th|span|label|figcaption|blockquote|summary|dt|dd)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
  const seen = new Set();
  for (const line of text.split('\n')) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (t.split(' ').length < 3 || seen.has(t)) continue;
    seen.add(t);
    out.blocks.push(t.slice(0, 400));
    if (out.blocks.length >= 400) break;
  }
  return out;
}

// ---------- optional browser mode ----------

async function loadPlaywright() {
  const req = createRequire(path.join(process.cwd(), 'noop.js'));
  for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      const mod = await import(pathToFileURL(req.resolve(name)).href);
      const chromium = mod.chromium || mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      // try the next package name
    }
  }
  return null;
}

// Bundled Chromium first, then the user's installed Chrome or Edge (playwright-core needs no download).
async function launchBrowser(chromium) {
  let lastErr;
  for (const opts of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { return await chromium.launch(opts); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

// A page driver with one interface: Playwright if the project has it, otherwise the
// user's own Chrome / Edge / Brave over the DevTools protocol (no install needed).
async function openBrowser() {
  const chromium = await loadPlaywright();
  if (chromium) {
    try {
      const browser = await launchBrowser(chromium);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: UA });
      return {
        kind: 'playwright',
        goto: (u) => page.goto(u, { waitUntil: 'networkidle', timeout: 45_000 })
          .catch(() => page.goto(u, { waitUntil: 'load', timeout: 45_000 })),
        evaluate: (src, arg) => page.evaluate(src, arg),
        screenshot: (file) => page.screenshot({ path: file }),
        wait: (ms) => page.waitForTimeout(ms),
        close: () => browser.close(),
      };
    } catch {
      // fall through to the installed browser
    }
  }
  return openChrome({ width: 1440, height: 900, userAgent: UA });
}

async function browserCapture(acc, url, outDir, { required }) {
  const page = await openBrowser();
  if (page.error) {
    console.error(`riff: browser capture unavailable (${page.error}). ${required ? '' : 'Motion and page rhythm will be missing. '}Continuing in static mode.`);
    return null;
  }
  console.error(`riff: capturing with ${page.kind}…`);
  try {
    await page.goto(url);
    await page.wait(1500);
    const screenshots = ['shot-00-top.png'];
    await page.screenshot(path.join(outDir, screenshots[0]));

    const data = await page.evaluate(() => {
      const props = ['color', 'background-color', 'border-top-color', 'font-family', 'font-size', 'font-weight',
        'line-height', 'letter-spacing', 'border-top-left-radius', 'box-shadow', 'padding-top', 'padding-left',
        'margin-top', 'margin-bottom', 'row-gap', 'column-gap', 'max-width', 'transition-duration',
        'transition-timing-function'];
      const skip = new Set(['normal', 'none', '0px', 'auto', 'rgba(0, 0, 0, 0)', '0s']);
      const decls = [];
      for (const el of [...document.querySelectorAll('body *')].slice(0, 3000)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        for (const p of props) {
          const v = cs.getPropertyValue(p);
          if (!v || skip.has(v)) continue;
          if (p === 'border-top-color' && cs.borderTopWidth === '0px') continue;
          decls.push([p.replace('border-top-left-radius', 'border-radius').replace('border-top-color', 'border-color'), v]);
        }
      }
      const blocks = (document.body.innerText || '').split('\n').map((t) => t.trim()).filter((t) => t.split(/\s+/).length >= 3);
      return { decls, blocks: [...new Set(blocks)].slice(0, 400), bodyBg: getComputedStyle(document.body).backgroundColor };
    });
    for (const [p, v] of data.decls) analyzeDeclaration(acc, p, v);
    addColor(acc, data.bodyBg, 'background');

    // How it feels: section map, hero, nav, and scroll motion (see probe.js).
    let experience = null;
    try {
      experience = await page.evaluate(await readFile(new URL('./probe.js', import.meta.url), 'utf8'));
    } catch (err) {
      console.error(`riff: motion probe failed (${err.message.split('\n')[0]}). Continuing without it.`);
    }

    // One screenshot per section, taken after scrolling there so reveals have played.
    for (const s of (experience?.sections || []).slice(1, 9)) {
      await page.evaluate((y) => window.scrollTo(0, y), s.top);
      await page.wait(1000);
      const name = `shot-${String(s.index).padStart(2, '0')}.png`;
      await page.screenshot(path.join(outDir, name));
      screenshots.push(name);
    }
    return { blocks: data.blocks, screenshots, experience, driver: page.kind };
  } finally {
    await page.close();
  }
}

// ---------- summarising ----------

function summariseColors(acc) {
  const all = [...acc.colors.entries()].map(([hex, e]) => {
    const rgb = parseColor(hex);
    const { L, C, h } = toOklch(rgb);
    const roles = e.roles.top(4).map((r) => r.value);
    return { hex, count: e.count, roles, L: +L.toFixed(3), C: +C.toFixed(3), h: Math.round(h), neutral: isNeutral(rgb) };
  }).sort((a, b) => b.count - a.count);

  // Merge near-identical chromatic colors so the signature list isn't five shades of one blue.
  // Shadow-only tints are depth, not identity.
  const signature = [];
  for (const c of all.filter((x) => !x.neutral && !(x.roles.length === 1 && x.roles[0] === 'shadow'))) {
    const twin = signature.find((s) => deltaE(parseColor(s.hex), parseColor(c.hex)) < 6);
    if (twin) twin.count += c.count;
    else signature.push({ ...c });
  }
  signature.sort((a, b) => b.count - a.count);
  return {
    all: all.slice(0, 60),
    signature: signature.slice(0, 5),
    neutrals: all.filter((c) => c.neutral).slice(0, 12),
  };
}

function baseUnit(spacing) {
  let total = 0, by4 = 0, by8 = 0;
  for (const { value, count } of spacing) {
    if (value < 2 || !Number.isInteger(value)) continue;
    total += count;
    if (value % 4 === 0) by4 += count;
    if (value % 8 === 0) by8 += count;
  }
  if (!total) return null;
  if (by8 / total >= 0.7) return 8;
  if (by4 / total >= 0.7) return 4;
  return 'irregular';
}

function typeScale(sizes) {
  const common = sizes.filter((s) => s.count >= 2 && s.value >= 12).map((s) => s.value);
  const uniq = [...new Set(common)].sort((a, b) => a - b);
  const ratios = [];
  for (let i = 1; i < uniq.length; i++) {
    const r = uniq[i] / uniq[i - 1];
    if (r >= 1.05) ratios.push(r);
  }
  ratios.sort((a, b) => a - b);
  const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  const body = sizes.filter((s) => s.value >= 14 && s.value <= 20).sort((a, b) => b.count - a.count)[0]?.value ?? null;
  return { ratio: median ? +median.toFixed(3) : null, body, largest: uniq.at(-1) ?? null, steps: uniq };
}

function brandTerms(meta, host) {
  const terms = new Set();
  const label = host.replace(/^www\./, '').split('.')[0];
  if (label.length >= 3) terms.add(label);
  const candidates = [meta.siteName, meta.appName, ...(meta.logoAlts || [])];
  // From the <title>, only take the part that contains the domain label ("Acme | Payments" → "Acme").
  for (const part of (meta.title || '').split(/\s+[|–—:·-]\s+/)) {
    if (part.toLowerCase().replace(/\s+/g, '').includes(label.toLowerCase())) candidates.push(part);
  }
  for (const s of candidates) {
    const t = (s || '').replace(/\blogo\b/gi, '').replace(/\s+/g, ' ').trim();
    if (t.length < 3 || t.length > 40 || t.split(' ').length > 4) continue;
    if (GENERIC_BRAND_WORDS.has(t.toLowerCase()) || /^redirect/i.test(t)) continue;
    terms.add(t);
  }
  return [...terms];
}

function experienceMarkdown(ref) {
  const sig = ref.motion.signals;
  const media = ref.motion.media;
  const staticLines = [
    `- Motion libraries: ${ref.motion.libs.join(', ') || 'none detected'}`,
    `- CSS: ${sig.sticky} sticky · ${sig.scrollTimelines} scroll-driven · ${sig.scrollSnap} scroll-snap · ${sig.backdropBlur} backdrop blur · reduced-motion rules: ${sig.reducedMotion}`,
    `- Keyframes: ${sig.keyframes.slice(0, 8).map((k) => k.value).join(', ') || 'none'}`,
    `- Hover changes: ${sig.hover.slice(0, 6).map((h) => `${h.value} ×${h.count}`).join(', ') || 'none found'}`,
    `- Media in HTML: ${media.videos} videos (${media.autoplayVideos} autoplay), ${media.canvases} canvases`,
  ].join('\n');

  const e = ref.experience;
  if (!e) {
    return `## Experience — NOT CAPTURED (static mode)

> ⚠ Static mode cannot see scroll animations, pinned sections, or page rhythm, and
> these are most of what makes premium sites feel premium. Capture with a browser
> (SKILL.md stage 2) before building. Until then, treat the lines below as hints only.

${staticLines}`;
  }

  const ms = e.motion.summary;
  const kinds = {};
  for (const m of e.motion.items) kinds[`${m.kind}: ${m.props.join('+')}`] = (kinds[`${m.kind}: ${m.props.join('+')}`] || 0) + 1;
  const timings = {};
  for (const m of e.motion.items) if (m.timing) timings[m.timing] = (timings[m.timing] || 0) + 1;
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ×${v}`).join(' · ') || 'none';
  const perSection = (i) => e.motion.items.filter((m) => m.section === i).length;
  const rows = e.sections.map((s) =>
    `| ${s.index} | ${s.heightVh} | ${s.dark ? 'dark' : 'light'}${s.backgroundImage ? ' +img' : ''} | ${s.headingSize || '–'}px ${s.headingAlign || ''} | ${s.largeMedia} | ${s.video} | ${s.columns} | ${s.sticky ? 'yes' : ''} | ${perSection(s.index)} |`).join('\n');

  return `## Experience (how it feels — MATCH this, it is not identity)
- Page: ${e.pageHeightVh} screens tall · ${e.sections.length} sections · viewport ${e.viewport.w}×${e.viewport.h}
- Nav: ${e.nav ? `${e.nav.position}, ${e.nav.height}px, ${e.nav.blur ? 'blurred translucent' : 'solid'} (${e.nav.background})` : 'not found'}
- Hero type: ${e.hero ? `${e.hero.size}px / ${e.hero.weight}, line-height ${e.hero.lineHeight}, tracking ${e.hero.letterSpacing}, ${e.hero.align}` : '?'}
- Motion: ${ms.reveal} scroll reveals · ${ms.scrub} scroll-scrubbed · ${ms.pinned} pinned · ${ms.stickySections} sections with sticky · ${ms.videos} videos · ${ms.canvases} canvases · ${ms.runningAnimations} running animations
- Motion types: ${top(kinds, 8)}
- Typical timing: ${top(timings, 3)}
${e.motion.pinned.length ? `- Pinned: ${e.motion.pinned.map((p) => `${p.el.slice(0, 40)} (${p.screens} screens)`).join('; ')}` : ''}
${staticLines}

### Section map (build the page from this, not from a template)
| # | height (screens) | tone | heading | large media | video | columns | sticky | motion items |
|---|---|---|---|---|---|---|---|---|
${rows}`;
}

function summaryMarkdown(ref) {
  const list = (arr, fmt) => arr.map(fmt).join('\n') || '- (none found)';
  const vals = (arr, n, sep = ', ') => arr.slice(0, n).map((x) => x.value).join(sep) || '?';
  const t = ref.type.scale;
  const logos = ref.assets.items.filter((a) => a.logo).map((a) => a.name).slice(0, 5);
  return `# riff capture — ${ref.host}

Captured ${ref.capturedAt} · mode: ${ref.mode} · ${ref.stats.stylesheets} stylesheets · ${ref.stats.requests} requests
URL: ${ref.finalUrl}

> Local analysis data. Do not commit or publish it, and apply
> references/transform-rules.md before any value reaches the build.

## Brand terms (must NOT appear in the build)
${list(ref.brand.terms, (x) => `- ${x}`)}

## Signature colors (identity — replace)
${list(ref.colors.signature, (c) => `- ${c.hex}  ×${c.count}  oklch(${c.L} ${c.C} ${c.h})  roles: ${c.roles.join(', ')}`)}

## Neutrals (relationships — fine to learn from)
${list(ref.colors.neutrals.slice(0, 8), (c) => `- ${c.hex}  ×${c.count}  L=${c.L}  roles: ${c.roles.join(', ')}`)}

## Fonts
${list(ref.fonts.families.slice(0, 6), (f) => `- ${f.value}  ×${f.count}`)}
${ref.fonts.proprietary.length ? `\nProprietary / licensed (SWAP, see font-swaps.md): ${ref.fonts.proprietary.join(', ')}` : ''}

Font faces:
${list(ref.fonts.faces.slice(0, 10), (f) => `- ${f.family} ${f.weight} — ${f.host}${f.knownOpen ? ' (known open-licence family — may keep, see transform rule 2)' : f.selfHosted ? ' (self-hosted, unknown licence → SWAP)' : f.open ? ' (open licence host)' : ' (licensed font service → SWAP)'}`)}
${ref.fonts.googleFamilies.length ? `\nGoogle Fonts: ${ref.fonts.googleFamilies.join(', ')}` : ''}

## Type scale
- Body ≈ ${t.body ?? '?'}px · largest ≈ ${t.largest ?? '?'}px · median step ratio ≈ ${t.ratio ?? '?'}
- Sizes: ${t.steps.join(', ') || '?'}
- Weights: ${vals(ref.type.weights, 6)}
- Line-heights: ${vals(ref.type.lineHeights, 6)}
- Letter-spacing: ${vals(ref.type.letterSpacing, 6)}

## Spacing & layout
- Base unit: ${ref.spacing.baseUnit ?? '?'}
- Common values: ${vals(ref.spacing.values, 14)}
- Max widths: ${vals(ref.layout.maxWidths, 6)}
- Breakpoints: ${vals(ref.layout.breakpoints, 8)}

## Shape & depth
- Radius: ${vals(ref.shape.radius, 8, ' | ')}
- Shadows:
${list(ref.shape.shadows.slice(0, 5), (s) => `  - ${s.value}`)}

## Motion tokens
- Durations (ms): ${vals(ref.motion.durations, 8)}
- Easings: ${vals(ref.motion.easings, 6, ' | ')}

${experienceMarkdown(ref)}

## Page structure (headings — for pattern analysis only, never reuse the text)
${list(ref.text.headings.slice(0, 20), (h) => `${'  '.repeat(h.level - 1)}- h${h.level}: ${h.text.slice(0, 80)}`)}

## Assets (never reuse or hotlink)
- ${ref.assets.items.length} images/media found${logos.length ? `, including logo files: ${logos.join(', ')}` : ''}
${ref.screenshots.length ? `\nScreenshots: ${ref.screenshots.join(', ')}` : ''}
`;
}

function fontSummary(acc, html) {
  const families = acc.families.top(12);
  const usage = new Map(acc.families.top(200).map((f) => [squashFamily(f.value), f.count]));
  // Most-used faces first, so the fonts that define the look aren't buried under icon fonts.
  const faces = dedupeFaces(acc.faces).sort((a, b) => (usage.get(squashFamily(b.family)) || 0) - (usage.get(squashFamily(a.family)) || 0));
  const proprietary = [...new Set([
    ...families.map((f) => f.value).filter((f) => KNOWN_PROPRIETARY.test(f) && !KNOWN_OPEN_FAMILIES.has(squashFamily(f))),
    ...faces.filter((f) => !f.open && (usage.get(squashFamily(f.family)) || 0) > 0).map((f) => f.family),
  ])];
  return {
    families,
    stacks: acc.stacks.top(6),
    faces,
    proprietary,
    googleFamilies: [...new Set(html.googleFamilies)],
  };
}

function dedupeFaces(faces) {
  const seen = new Map();
  for (const f of faces) {
    const key = f.family.toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...f, weights: new Set([f.weight].filter(Boolean)) });
    else if (f.weight) seen.get(key).weights.add(f.weight);
  }
  return [...seen.values()]
    .map(({ weights, ...f }) => ({ ...f, weight: [...weights].join(' ') }))
    .filter((f) => !GENERIC_FAMILIES.has(f.family.toLowerCase()));
}

// ---------- main ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.url) {
    console.log('usage: node extract.mjs <url> [--out .riff] [--browser | --static] [--experience probe.json] [--own-site]');
    process.exit(opts.help ? 0 : 2);
  }
  const url = /^https?:\/\//i.test(opts.url) ? opts.url : 'https://' + opts.url;
  let parsed;
  try { parsed = new URL(url); } catch { fail(`Not a valid URL: ${opts.url}`, 2); }
  if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|\[::1\])/.test(parsed.hostname) && !opts.ownSite) {
    fail('Refusing to capture a local/private address without --own-site.', 2);
  }

  if (opts.ownSite) {
    console.error('riff: --own-site set — skipping robots.txt/TDM checks. Only for sites you own or have permission to analyse.');
  } else {
    const access = await checkAccess(url);
    if (!access.allowed) fail(`${access.reason}. riff respects this; ask the user for a screenshot instead.`, 3);
  }

  const page = await get(url, { maxBytes: MAX_HTML_BYTES, accept: 'text/html,application/xhtml+xml' });
  if (!page?.ok) {
    fail(`Could not load ${url} (HTTP ${page?.status ?? '?'}${page?.error ? `: ${page.error}` : ''}). The site may block automated requests; use a screenshot instead.`, 4);
  }
  if (!opts.ownSite) {
    const reserved = tdmReservedInPage(page);
    if (reserved) fail(`${new URL(page.url).host} reserves text-and-data-mining rights (${reserved}). riff respects this.`, 3);
  }
  const forward = redirectTarget(page.text, page.url);
  if (forward && forward !== new URL(page.url).origin + '/') {
    fail(`${page.url} is a redirect page that forwards to ${forward}. Run riff on that URL instead.`, 5);
  }
  if (page.text.length < 60_000 && /cf-challenge|challenge-platform|px-captcha|g-recaptcha|hcaptcha/i.test(page.text)) {
    fail('The page returned a bot challenge. riff does not bypass bot protection; use a screenshot instead.', 4);
  }

  const acc = newAcc();
  const html = analyzeHtml(acc, page.text, page.url);
  for (const css of html.inlineCss) analyzeCss(acc, css, page.url, '');

  // Code-split sites link dozens of sheets. Global styles usually have a telling name
  // (layout, global, main...) or sit at either end of the list, so take those first.
  const sheets = [...new Set(html.stylesheets)];
  let queue = sheets;
  if (sheets.length > MAX_STYLESHEETS) {
    const named = sheets.filter((s) => /layout|global|main|app|base|theme|style|common|index|root|fonts?/i.test(s.split('/').pop()));
    const half = Math.floor(MAX_STYLESHEETS / 2);
    queue = [...new Set([...named, ...sheets.slice(0, half), ...sheets.slice(-half)])].slice(0, MAX_STYLESHEETS);
  }
  let sheetCount = 0, cssBytes = 0;
  const fetched = new Set();
  while (queue.length && sheetCount < MAX_STYLESHEETS) {
    const href = queue.shift();
    if (fetched.has(href)) continue;
    fetched.add(href);
    const res = await get(href, { accept: 'text/css,*/*;q=0.1' });
    if (!res?.ok) continue;
    sheetCount++;
    cssBytes += res.text.length;
    for (const m of res.text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?/gi)) {
      const abs = resolve(m[1], res.url);
      if (abs && !fetched.has(abs) && queue.length < MAX_STYLESHEETS) queue.push(abs);
    }
    analyzeCss(acc, res.text, res.url, res.url);
  }
  analyzeCollected(acc);

  const outDir = path.resolve(opts.out);
  await mkdir(outDir, { recursive: true });

  // Browser capture runs whenever Playwright is available; --static opts out, --browser insists.
  // --experience merges probe.js output gathered in another browser tool.
  const browser = opts.static || opts.experience ? null : await browserCapture(acc, page.url, outDir, { required: opts.browser });
  let experience = browser?.experience || null;
  if (opts.experience) {
    try {
      experience = JSON.parse(await readFile(opts.experience, 'utf8'));
    } catch (err) {
      fail(`Cannot read --experience ${opts.experience}: ${err.message}`, 2);
    }
    if (experience?.tool !== 'riff-probe') fail(`${opts.experience} is not probe.js output.`, 2);
  }
  const host = new URL(page.url).host;
  const sizes = acc.sizes.top(40);
  const spacing = acc.spacing.top(40);
  const ref = {
    tool: 'riff',
    version: VERSION,
    url,
    finalUrl: page.url,
    host,
    capturedAt: new Date().toISOString(),
    mode: browser ? `browser (${browser.driver})` : experience ? 'static + probe' : 'static',
    brand: { terms: brandTerms(html.meta, host), title: html.meta.title, siteName: html.meta.siteName },
    colors: summariseColors(acc),
    fonts: fontSummary(acc, html),
    type: {
      sizes,
      scale: typeScale(sizes),
      weights: acc.weights.top(10),
      lineHeights: acc.lineHeights.top(10),
      letterSpacing: acc.tracking.top(10),
    },
    spacing: { values: spacing, baseUnit: baseUnit(spacing) },
    layout: { maxWidths: acc.maxWidths.top(10), breakpoints: acc.breakpoints.top(12) },
    shape: { radius: acc.radius.top(12), shadows: acc.shadows.top(10) },
    motion: {
      durations: acc.durations.top(12),
      easings: acc.easings.top(10),
      libs: [...new Set([...html.motionLibs, ...(experience?.libs || [])])],
      signals: {
        ...acc.signals,
        keyframes: acc.signals.keyframes.top(15),
        hover: acc.signals.hover.top(10),
      },
      media: html.media,
    },
    experience,
    customProperties: [...acc.customProps.entries()].slice(0, 300).map(([name, value]) => ({ name, value })),
    assets: {
      items: [...acc.assets.values()].slice(0, 300),
      hosts: [...new Set([...acc.assets.keys()].map((u) => { try { return new URL(u).host; } catch { return null; } }).filter(Boolean))],
    },
    text: {
      headings: html.headings.slice(0, 80),
      blocks: (browser?.blocks?.length ? browser.blocks : html.blocks).slice(0, 400),
    },
    screenshots: browser?.screenshots || [],
    stats: { stylesheets: sheetCount, cssBytes, requests: requestCount },
  };

  const md = summaryMarkdown(ref);
  await writeFile(path.join(outDir, 'reference.json'), JSON.stringify(ref, null, 2));
  await writeFile(path.join(outDir, 'summary.md'), md);
  console.log(md);
  console.log(`Wrote ${path.join(opts.out, 'reference.json')} and ${path.join(opts.out, 'summary.md')}`);
  if (!browser && acc.colors.size < 3) {
    console.log('Note: very little CSS found statically (JS-rendered site?). Try --browser or a screenshot.');
  }
}

const isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] || '')).href;
if (isMain) main().catch((err) => fail(err.stack || String(err)));

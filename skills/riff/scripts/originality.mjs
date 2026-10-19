#!/usr/bin/env node
// riff originality check: compares a project against captured reference(s) and flags
// copied text, brand terms, hotlinked/reused assets, proprietary fonts, and signature colors.
//
//   node originality.mjs --ref .riff/reference.json [--ref ...] [--project .]
//                        [--out .riff/originality.json] [--ignore-term <word>]
//
// Exit codes: 0 pass (warnings allowed), 1 fail, 2 usage error.

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COLOR_RE, parseColor, toHex, deltaE, isNeutral } from './lib/color.mjs';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.riff', '.next', '.nuxt', '.svelte-kit', '.output', 'dist', 'build', 'out',
  '.vercel', '.netlify', 'coverage', '.turbo', '.cache', 'vendor', '.expo', '.claude', '.agents', '.cursor',
]);
// Docs that legitimately name the reference ("Inspired by ...") and never ship to users.
const SKIP_FILES = new Set([
  'design.md', 'readme.md', 'changelog.md', 'contributing.md', 'riff-report.md',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
]);
const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.vue', '.svelte', '.astro', '.md', '.mdx', '.json', '.yaml', '.yml', '.liquid', '.hbs', '.ejs',
  '.njk', '.php', '.erb',
]);
const STYLE_EXT = new Set(['.css', '.scss', '.sass', '.less']);
const ASSET_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.mp4', '.webm', '.mov', '.lottie',
  '.glb', '.gltf', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot',
]);
const FONT_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
const GENERIC_ASSET_NAMES = new Set([
  'logo', 'icon', 'favicon', 'hero', 'image', 'img', 'bg', 'background', 'avatar', 'og', 'og-image',
  'placeholder', 'apple-touch-icon', 'banner', 'cover', 'thumbnail', 'poster', 'video', 'preview',
  'screenshot', 'photo', 'pattern', 'noise', 'grain', 'arrow', 'check', 'close', 'menu', 'search',
]);
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica', 'arial', 'inherit',
]);
const STOP = new Set(('a an and are as at be but by for from has have i in is it its of on or our so ' +
  'that the their this to was we were will with you your can all more get new now one just how what').split(' '));
const SHINGLE = 6;
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 2_000_000;
const TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'com.au', 'co.jp', 'com.br', 'com.ae', 'co.in', 'com.sg', 'co.nz', 'com.tr',
  'com.mx', 'co.za', 'com.cn', 'com.hk', 'co.kr', 'com.sa', 'com.eg',
]);

// ---------- args ----------

function parseArgs(argv) {
  const opts = { refs: [], project: '.', out: null, ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ref') opts.refs.push(argv[++i]);
    else if (a === '--project') opts.project = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--ignore-term') opts.ignore.push(String(argv[++i]).toLowerCase());
    else if (a === '--help' || a === '-h') opts.help = true;
    else usage(`Unknown option ${a}`);
  }
  return opts;
}

function usage(msg) {
  if (msg) console.error(`riff: ${msg}`);
  console.error('usage: node originality.mjs --ref .riff/reference.json [--ref ...] [--project .] [--out file] [--ignore-term word]');
  process.exit(2);
}

// ---------- project scan ----------

async function walk(root) {
  const text = [];
  const assets = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(full);
        continue;
      }
      if (!e.isFile()) continue;
      const lower = e.name.toLowerCase();
      const ext = path.extname(lower);
      if (SKIP_FILES.has(lower) || lower.startsWith('license') || /\.min\.(js|css)$/.test(lower)) continue;
      if (TEXT_EXT.has(ext)) text.push(full);
      else if (ASSET_EXT.has(ext)) assets.push(full);
      if (text.length + assets.length >= MAX_FILES) return { text, assets, truncated: true };
    }
  }
  return { text, assets, truncated: false };
}

async function loadFiles(paths, root) {
  const files = [];
  for (const p of paths) {
    try {
      if ((await stat(p)).size > MAX_FILE_BYTES) continue;
      files.push({ path: p, rel: path.relative(root, p) || p, ext: path.extname(p).toLowerCase(), content: await readFile(p, 'utf8') });
    } catch {
      // unreadable file; skip
    }
  }
  return files;
}

// ---------- helpers ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function words(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[\p{L}\p{N}]+/gu) || [];
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function registrableDomain(host) {
  const parts = host.replace(/^www\./, '').toLowerCase().split('.');
  const lastTwo = parts.slice(-2).join('.');
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

function bounded(term, flags) {
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRe(term)}(?![\\p{L}\\p{N}_-])`, flags);
}

function firstFamily(value) {
  return value.split(',')[0].trim().replace(/^["']|["']$/g, '').trim();
}

// ---------- checks ----------

function checkCopiedText(ref, files, findings) {
  const shingles = new Map();
  const blocks = [...ref.text.blocks, ...ref.text.headings.map((h) => h.text)];
  blocks.forEach((block, bi) => {
    const w = words(block);
    for (let i = 0; i + SHINGLE <= w.length; i++) {
      const win = w.slice(i, i + SHINGLE);
      if (win.filter((x) => !STOP.has(x) && x.length > 2).length < 3) continue;
      shingles.set(win.join(' '), bi);
    }
  });
  // Short but distinctive headings (4–5 words) are checked as whole phrases.
  const shortHeadings = ref.text.headings
    .map((h) => words(h.text))
    .filter((w) => w.length >= 4 && w.length < SHINGLE && w.filter((x) => !STOP.has(x)).length >= 3)
    .map((w) => w.join(' '));

  for (const f of files) {
    const w = words(f.content);
    const hitBlocks = new Set();
    for (let i = 0; i + SHINGLE <= w.length; i++) {
      const bi = shingles.get(w.slice(i, i + SHINGLE).join(' '));
      if (bi != null) hitBlocks.add(bi);
    }
    const joined = ' ' + w.join(' ') + ' ';
    for (const h of shortHeadings) {
      if (joined.includes(' ' + h + ' ')) hitBlocks.add(`h:${h}`);
    }
    for (const bi of hitBlocks) {
      const text = typeof bi === 'string' ? bi.slice(2) : blocks[bi];
      findings.push({
        check: 'copied-text', level: 'FAIL', file: f.rel,
        message: `Text from ${ref.host} appears in the project`,
        detail: `"${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`,
      });
    }
  }
}

function brandPatterns(ref, ignore) {
  const out = [];
  const domain = registrableDomain(ref.host);
  out.push({ term: domain, re: new RegExp(escapeRe(domain), 'gi'), styles: true });
  const seen = new Set();
  for (const t of ref.brand.terms) {
    if (ignore.includes(t.toLowerCase())) continue;
    // Case-sensitive on purpose: "Linear" (the brand) vs "linear" (the CSS keyword),
    // so an all-lowercase term is only matched capitalised or in caps.
    for (const form of [t.toUpperCase(), t === t.toLowerCase() ? t[0].toUpperCase() + t.slice(1) : t]) {
      if (seen.has(form)) continue;
      seen.add(form);
      out.push({ term: form, re: bounded(form, 'gu'), styles: false });
    }
  }
  return out;
}

function checkBrandTerms(ref, files, ignore, findings) {
  for (const p of brandPatterns(ref, ignore)) {
    for (const f of files) {
      if (!p.styles && STYLE_EXT.has(f.ext)) continue;
      p.re.lastIndex = 0;
      const m = p.re.exec(f.content);
      if (!m) continue;
      const isDomain = p.styles;
      findings.push({
        check: isDomain ? 'hotlinked-asset' : 'brand-term',
        level: 'FAIL',
        file: f.rel,
        line: lineOf(f.content, m.index),
        message: isDomain
          ? `Reference domain "${p.term}" is referenced (hotlinked asset or link to the reference)`
          : `Reference brand term "${p.term}" appears in the build`,
        detail: f.content.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ').trim(),
      });
    }
  }
}

function checkAssetHosts(ref, files, findings) {
  const label = ref.host.replace(/^www\./, '').split('.')[0].toLowerCase();
  const domain = registrableDomain(ref.host);
  // Hosts dedicated to the brand (e.g. "<brand>cdn.com", "images.<brand>assets.com").
  const hosts = (ref.assets.hosts || []).filter((h) => {
    const lower = h.toLowerCase();
    return label.length >= 4 && lower.includes(label) && !lower.endsWith(domain);
  });
  const exactUrls = (ref.assets.items || []).map((a) => a.url.replace(/^https?:/, '')).filter((u) => u.length > 12);
  for (const f of files) {
    for (const h of hosts) {
      const i = f.content.toLowerCase().indexOf(h.toLowerCase());
      if (i >= 0) findings.push({ check: 'hotlinked-asset', level: 'FAIL', file: f.rel, line: lineOf(f.content, i), message: `Loads files from the reference's asset host ${h}` });
    }
    for (const u of exactUrls) {
      const i = f.content.indexOf(u);
      if (i >= 0) findings.push({ check: 'hotlinked-asset', level: 'FAIL', file: f.rel, line: lineOf(f.content, i), message: 'Uses an exact asset URL from the reference', detail: u });
    }
  }
}

function checkReusedAssets(ref, assetPaths, root, findings) {
  const refNames = new Map();
  for (const a of ref.assets.items || []) {
    const base = a.name.toLowerCase();
    const stem = base.replace(/\.[^.]+$/, '');
    if (stem.length < 5 || GENERIC_ASSET_NAMES.has(stem)) continue;
    refNames.set(base, a);
  }
  for (const p of assetPaths) {
    const base = path.basename(p).toLowerCase();
    const hit = refNames.get(base);
    if (hit) {
      findings.push({
        check: 'reused-asset', level: 'FAIL', file: path.relative(root, p),
        message: `File has the same name as a ${hit.logo ? 'logo' : 'media'} asset on ${ref.host}`,
        detail: hit.url,
      });
    }
  }
}

function checkFonts(ref, files, assetPaths, root, findings) {
  const proprietary = [
    ...(ref.fonts.faces || []).filter((f) => !f.open && !GENERIC_FAMILIES.has(f.family.toLowerCase())).map((f) => f.family),
    ...(ref.fonts.proprietary || []),
  ];
  for (const fam of new Set(proprietary)) {
    const re = bounded(fam, 'giu');
    const squashed = fam.toLowerCase().replace(/[\s_-]+/g, '');
    for (const f of files) {
      const lines = f.content.split('\n');
      const idx = lines.findIndex((l) => /font|family|typeface|@font-face/i.test(l) && (re.lastIndex = 0, re.test(l)));
      if (idx >= 0) {
        findings.push({ check: 'proprietary-font', level: 'FAIL', file: f.rel, line: idx + 1, message: `Uses "${fam}", which ${ref.host} self-hosts or licenses. Swap it (font-swaps.md).` });
      }
    }
    for (const p of assetPaths) {
      if (!FONT_EXT.has(path.extname(p).toLowerCase())) continue;
      if (path.basename(p).toLowerCase().replace(/[\s_-]+/g, '').includes(squashed)) {
        findings.push({ check: 'proprietary-font', level: 'FAIL', file: path.relative(root, p), message: `Font file looks like "${fam}" from ${ref.host}` });
      }
    }
  }

  const refPrimary = (ref.fonts.families || []).map((f) => f.value).find((v) => v && !GENERIC_FAMILIES.has(v.toLowerCase()) && !v.startsWith('var('));
  const projPrimary = projectPrimaryFont(files);
  if (refPrimary && projPrimary && refPrimary.toLowerCase() === projPrimary.toLowerCase() && !proprietary.includes(refPrimary)) {
    findings.push({
      check: 'same-font-stack', level: 'WARN',
      message: `Primary font "${projPrimary}" is the same as ${ref.host}'s. Fine on its own if colors and layout clearly differ; otherwise pair or swap it.`,
    });
  }
}

function projectPrimaryFont(files) {
  const counts = new Map();
  const add = (name, n = 1) => {
    if (!name || GENERIC_FAMILIES.has(name.toLowerCase()) || name.startsWith('var(')) return;
    counts.set(name, (counts.get(name) || 0) + n);
  };
  for (const f of files) {
    for (const m of f.content.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) add(firstFamily(m[1]));
    for (const m of f.content.matchAll(/import\s*{([^}]+)}\s*from\s*["']next\/font\/google["']/g)) {
      for (const n of m[1].split(',')) add(n.trim().split(/\s+as\s+/)[0].replace(/_/g, ' '), 3);
    }
    for (const m of f.content.matchAll(/@fontsource(?:-variable)?\/([a-z0-9-]+)/g)) add(m[1].replace(/-/g, ' '), 3);
    for (const m of f.content.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^&:"')]+)/g)) add(decodeURIComponent(m[1]).replace(/\+/g, ' '), 3);
  }
  let best = null;
  for (const [name, n] of counts) if (!best || n > best[1]) best = [name, n];
  return best?.[0] ?? null;
}

function checkColors(ref, files, findings) {
  const projectColors = new Map(); // hex -> first file
  for (const f of files) {
    if (f.ext === '.md' || f.ext === '.mdx') continue;
    for (const m of f.content.matchAll(COLOR_RE)) {
      const c = parseColor(m[0]);
      if (!c || c.a < 0.1 || isNeutral(c)) continue;
      const hex = toHex(c);
      if (!projectColors.has(hex)) projectColors.set(hex, { file: f.rel, line: lineOf(f.content, m.index) });
    }
  }
  for (const sig of (ref.colors.signature || []).slice(0, 3)) {
    const s = parseColor(sig.hex);
    let best = null;
    for (const [hex, where] of projectColors) {
      const d = deltaE(s, parseColor(hex));
      if (!best || d < best.d) best = { hex, d, ...where };
    }
    if (best && best.d < 5) {
      findings.push({
        check: 'signature-color', level: 'WARN', file: best.file, line: best.line,
        message: `${best.hex} is ${best.d < 2 ? 'identical' : 'very close'} to ${ref.host}'s signature color ${sig.hex} (ΔE ${best.d.toFixed(1)}). Rotate the hue ≥ 30° or use the user's brand color.`,
      });
    }
  }
}

// ---------- main ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) usage();
  if (!opts.refs.length) opts.refs.push('.riff/reference.json');
  const root = path.resolve(opts.project);

  const refs = [];
  for (const r of opts.refs) {
    let ref;
    try { ref = JSON.parse(await readFile(r, 'utf8')); } catch (err) { usage(`Cannot read ${r}: ${err.message}`); }
    if (ref.tool !== 'riff') usage(`${r} is not a riff reference.json`);
    refs.push(ref);
  }

  const scan = await walk(root);
  const files = await loadFiles(scan.text, root);
  const findings = [];
  for (const ref of refs) {
    checkCopiedText(ref, files, findings);
    checkBrandTerms(ref, files, opts.ignore, findings);
    checkAssetHosts(ref, files, findings);
    checkReusedAssets(ref, scan.assets, root, findings);
    checkFonts(ref, files, scan.assets, root, findings);
    checkColors(ref, files, findings);
  }

  const verdict = findings.some((f) => f.level === 'FAIL') ? 'FAIL' : findings.length ? 'WARN' : 'PASS';
  const result = {
    tool: 'riff',
    verdict,
    references: refs.map((r) => r.host),
    findings,
    stats: { textFiles: files.length, assetFiles: scan.assets.length, truncated: scan.truncated },
  };
  const out = opts.out || path.join(path.dirname(path.resolve(opts.refs[0])), 'originality.json');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result, null, 2));

  console.log(`riff originality check — ${verdict}`);
  console.log(`references: ${result.references.join(', ')} · scanned ${files.length} text files, ${scan.assets.length} assets${scan.truncated ? ' (truncated)' : ''}\n`);
  for (const f of findings) {
    const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '';
    console.log(`${f.level.padEnd(4)}  ${f.check.padEnd(16)} ${where}`);
    console.log(`      ${f.message}`);
    if (f.detail) console.log(`      ${f.detail}`);
  }
  if (!findings.length) console.log('No copied text, brand terms, reused assets, proprietary fonts, or signature colors found.');
  console.log('\nAlso do the visual check in references/originality-check.md. Not legal advice.');
  console.log(`Wrote ${path.relative(process.cwd(), out) || out}`);
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

main().catch((err) => {
  console.error(`riff: ${err.stack || err}`);
  process.exit(2);
});

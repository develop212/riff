#!/usr/bin/env node
// riff feel check: does the build FEEL like the reference? Compares the `experience`
// captured from the reference with one captured from the running build.
//
//   node extract.mjs http://localhost:3000 --own-site --out .riff/build     (capture the build)
//   node feel.mjs --ref .riff/reference.json --build .riff/build/reference.json
//
// Exit codes: 0 PASS or WARN, 1 FAIL, 2 usage error / missing capture.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASS_AT = 75;
const WARN_AT = 60;

function usage(msg) {
  if (msg) console.error(`riff: ${msg}`);
  console.error('usage: node feel.mjs --ref .riff/reference.json --build .riff/build/reference.json [--out file]');
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') opts.ref = argv[++i];
    else if (argv[i] === '--build') opts.build = argv[++i];
    else if (argv[i] === '--out') opts.out = argv[++i];
    else usage(`Unknown option ${argv[i]}`);
  }
  if (!opts.ref || !opts.build) usage();
  return opts;
}

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const median = (arr) => {
  const s = arr.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
// 100 within ±tol of a match, falling to 0 at ±(tol + span).
function ratioScore(a, b, tol = 0.1, span = 0.4) {
  if (!a || !b) return null;
  const off = Math.abs(Math.log(b / a));
  return clamp(100 * (1 - Math.max(0, off - Math.log(1 + tol)) / Math.log(1 + tol + span)));
}
const avg = (scores) => {
  const s = scores.filter((v) => v != null);
  return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null;
};

// Dark/light pattern sampled at 24 points down the page, so pages of different length compare.
function toneProfile(sections) {
  const total = sections.reduce((n, s) => n + s.heightVh, 0) || 1;
  const out = [];
  for (let i = 0; i < 24; i++) {
    const at = ((i + 0.5) / 24) * total;
    let acc = 0;
    const s = sections.find((x) => (acc += x.heightVh) >= at) || sections.at(-1);
    out.push(s?.dark ? 1 : 0);
  }
  return out;
}

export function compare(ref, build) {
  const r = ref.experience, b = build.experience;
  const gaps = [];
  const axes = {};
  const sectionMedian = (ex, key) => median(ex.sections.map((s) => s[key]));

  // Hero scale
  const heroSize = ratioScore(r.hero?.size, b.hero?.size);
  const weightMatch = r.hero && b.hero ? (Number(r.hero.weight) >= 600) === (Number(b.hero.weight) >= 600) : null;
  const trackSign = r.hero && b.hero
    ? Math.sign(parseFloat(r.hero.letterSpacing) || 0) === Math.sign(parseFloat(b.hero.letterSpacing) || 0)
    : null;
  axes.hero = avg([heroSize, weightMatch == null ? null : weightMatch ? 100 : 40, trackSign == null ? null : trackSign ? 100 : 50]);
  if (heroSize != null && heroSize < 80) gaps.push(`Hero type is ${b.hero.size}px; reference is ${r.hero.size}px. Match it within ±10%.`);
  if (weightMatch === false) gaps.push(`Hero weight ${b.hero.weight} vs reference ${r.hero.weight}: use the same weight class.`);
  if (trackSign === false) gaps.push(`Hero tracking is ${b.hero.letterSpacing}; reference uses ${r.hero.letterSpacing}. Display type needs the same tight/loose tracking.`);

  // Rhythm: section count, section height, page length, tone pattern
  const count = ratioScore(r.sections.length, b.sections.length, 0.2, 0.6);
  const height = ratioScore(sectionMedian(r, 'heightVh'), sectionMedian(b, 'heightVh'), 0.2, 0.6);
  const pageLen = ratioScore(r.pageHeightVh, b.pageHeightVh, 0.25, 0.75);
  const rt = toneProfile(r.sections), bt = toneProfile(b.sections);
  const tone = (rt.filter((v, i) => v === bt[i]).length / rt.length) * 100;
  axes.rhythm = avg([count, height, pageLen, tone]);
  if (count != null && count < 70) gaps.push(`Build has ${b.sections.length} sections; reference has ${r.sections.length}. Follow the section map.`);
  if (height != null && height < 70) gaps.push(`Typical section is ${sectionMedian(b, 'heightVh')} screens tall; reference is ${sectionMedian(r, 'heightVh')}. Restore the vertical space.`);
  if (pageLen != null && pageLen < 60) gaps.push(`Page is ${b.pageHeightVh} screens; reference is ${r.pageHeightVh}. Scroll stories need length.`);
  if (tone < 70) gaps.push(`Dark/light rhythm differs (${Math.round(tone)}% match). Mirror the tone sequence in the section map.`);

  // Media
  const share = (ex) => (ex.sections.length ? ex.sections.filter((s) => s.largeMedia > 0).length / ex.sections.length : 0);
  const mediaShare = clamp(100 - Math.abs(share(r) - share(b)) * 200);
  const rv = r.motion.summary.videos, bv = b.motion.summary.videos;
  const video = rv > 0 ? clamp((bv / Math.max(1, Math.ceil(rv * 0.3))) * 100) : null;
  axes.media = avg([mediaShare, video]);
  if (mediaShare < 70) gaps.push(`${Math.round(share(b) * 100)}% of build sections have large media; reference has ${Math.round(share(r) * 100)}%. See motion-playbook §4.`);
  if (video != null && video < 70) gaps.push(`Reference uses ${rv} videos; build has ${bv}. Add motion footage (the user's, generated, or licensed stock).`);

  // Motion
  const rs = r.motion.summary, bs = b.motion.summary;
  const motionParts = [];
  const want = (name, refN, buildN, factor, fix) => {
    if (!refN) return;
    const target = Math.max(1, Math.round(refN * factor));
    const s = clamp((buildN / target) * 100);
    motionParts.push(s);
    if (s < 80) gaps.push(`${name}: reference ${refN}, build ${buildN} (target ≥ ${target}). ${fix}`);
  };
  want('Scroll reveals', rs.reveal, bs.reveal, 0.7, 'Add data-reveal to headings, copy and media (motion-playbook §3).');
  want('Scroll-scrubbed motion', rs.scrub, bs.scrub, 0.5, 'Add data-scrub to media and copy in story sections.');
  want('Pinned sections', rs.pinned, bs.pinned, 1, 'Add data-pin scroll stories where the section map shows them.');
  want('Sticky sections', rs.stickySections, bs.stickySections, 0.5, 'Use position: sticky for side-by-side story sections.');
  if (!rs.reveal && !rs.scrub && !rs.pinned && bs.reveal + bs.scrub + bs.pinned > 10) {
    gaps.push('Reference is mostly still, but the build adds lots of motion. Tone it down to match.');
    motionParts.push(50);
  }
  axes.motion = motionParts.length ? avg(motionParts) : 100;

  // Nav
  const fixedish = (n) => n && (n.position === 'fixed' || n.position === 'sticky');
  axes.nav = r.nav && b.nav ? avg([fixedish(r.nav) === fixedish(b.nav) ? 100 : 30, r.nav.blur === b.nav.blur ? 100 : 50]) : null;
  if (r.nav && b.nav && fixedish(r.nav) !== fixedish(b.nav)) gaps.push(`Nav is ${b.nav.position}; reference nav is ${r.nav.position}.`);
  if (r.nav && b.nav && r.nav.blur && !b.nav.blur) gaps.push('Reference nav is translucent with backdrop blur; build nav is solid.');

  // Section heading scale
  axes.headings = ratioScore(sectionMedian(r, 'headingSize'), sectionMedian(b, 'headingSize'), 0.12, 0.5);
  if (axes.headings != null && axes.headings < 75) {
    gaps.push(`Typical section heading is ${sectionMedian(b, 'headingSize')}px; reference is ${sectionMedian(r, 'headingSize')}px.`);
  }

  const weights = { hero: 15, rhythm: 20, media: 20, motion: 30, nav: 5, headings: 10 };
  let total = 0, wsum = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (axes[k] == null) continue;
    total += axes[k] * w;
    wsum += w;
  }
  return {
    score: Math.round(wsum ? total / wsum : 0),
    axes: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, v == null ? null : Math.round(v)])),
    gaps,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const load = async (p) => {
    try { return JSON.parse(await readFile(p, 'utf8')); } catch (err) { usage(`Cannot read ${p}: ${err.message}`); }
  };
  const ref = await load(opts.ref);
  const build = await load(opts.build);
  for (const [name, r] of [['reference', ref], ['build', build]]) {
    if (!r.experience) {
      usage(`The ${name} capture has no experience data. Capture it with a browser (Playwright, or run probe.js in a browser tool and save the result as "experience" in the JSON).`);
    }
  }

  const result = compare(ref, build);
  const verdict = result.score >= PASS_AT ? 'PASS' : result.score >= WARN_AT ? 'WARN' : 'FAIL';
  const out = opts.out || path.join(path.dirname(path.resolve(opts.ref)), 'feel.json');
  await writeFile(out, JSON.stringify({ tool: 'riff', verdict, ...result }, null, 2));

  console.log(`riff feel check — ${verdict} (${result.score}/100, pass at ${PASS_AT})`);
  console.log(`reference: ${ref.host}   build: ${build.host}\n`);
  for (const [k, v] of Object.entries(result.axes)) {
    if (v == null) continue;
    console.log(`  ${k.padEnd(9)} ${'█'.repeat(Math.round(v / 10)).padEnd(10, '·')} ${v}`);
  }
  if (result.gaps.length) {
    console.log('\nGaps to close:');
    for (const g of result.gaps) console.log(`  - ${g}`);
  }
  console.log(`\nWrote ${path.relative(process.cwd(), out) || out}`);
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`riff: ${err.stack || err}`);
    process.exit(2);
  });
}

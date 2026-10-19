#!/usr/bin/env node
// Offline self-test: unit checks plus an end-to-end originality run on synthetic fixtures.
// No network, no real brand data.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { robotsAllows } from '../skills/riff/scripts/extract.mjs';
import { parseColor, toHex, deltaE, isNeutral } from '../skills/riff/scripts/lib/color.mjs';
import { compare } from '../skills/riff/scripts/feel.mjs';
import { findChrome } from '../skills/riff/scripts/lib/chrome.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, '..', 'skills', 'riff');
const ORIGINALITY = path.join(here, '..', 'skills', 'riff', 'scripts', 'originality.mjs');

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}

// --- robots.txt ---
const r1 = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\n';
check('robots: * disallow', robotsAllows(r1, 'riff', '/private/x'), false);
check('robots: longer allow wins', robotsAllows(r1, 'riff', '/private/ok/1'), true);
check('robots: root allowed', robotsAllows(r1, 'riff', '/'), true);
check('robots: riff group blocks', robotsAllows('User-agent: riff\nDisallow: /\n\nUser-agent: *\nAllow: /\n', 'riff', '/'), false);
check('robots: other bot ignored', robotsAllows('User-agent: Googlebot\nDisallow: /\n', 'riff', '/'), true);
check('robots: wildcard + anchor', robotsAllows('User-agent: *\nDisallow: /*.pdf$\n', 'riff', '/a/b.pdf'), false);
check('robots: empty disallow', robotsAllows('User-agent: *\nDisallow:\n', 'riff', '/'), true);

// --- colors ---
check('color: hex3', toHex(parseColor('#abc')), '#aabbcc');
check('color: rgb modern', toHex(parseColor('rgb(83 58 253 / .5)')), '#533afd');
check('color: hsl legacy', toHex(parseColor('hsl(0, 100%, 50%)')), '#ff0000');
check('color: oklch', toHex(parseColor('oklch(0.628 0.2577 29.23)')), '#ff0000');
check('color: var() ignored', parseColor('rgb(var(--x))'), null);
check('color: deltaE identical', deltaE(parseColor('#533afd'), parseColor('#533afd')), 0);
check('color: navy text is neutral', isNeutral(parseColor('#0b1b2e')), true);
check('color: violet is not neutral', isNeutral(parseColor('#533afd')), false);

// --- feel check scoring ---
const experience = (o = {}) => ({
  experience: {
    pageHeightVh: o.pageHeightVh ?? 20,
    hero: { size: o.hero ?? 64, weight: '600', letterSpacing: o.tracking ?? '-1px' },
    nav: { position: o.nav ?? 'sticky', blur: o.blur ?? true },
    sections: Array.from({ length: o.sections ?? 8 }, (_, i) => ({
      index: i, heightVh: o.height ?? 1.5, dark: o.dark ?? i < 4, headingSize: o.heading ?? 56, largeMedia: o.media ?? 1,
    })),
    motion: { summary: { reveal: o.reveal ?? 40, scrub: o.scrub ?? 10, pinned: o.pinned ?? 2, stickySections: o.sticky ?? 2, videos: o.videos ?? 4 } },
  },
});
const same = compare(experience(), experience());
check('feel: identical experience scores ≥ 95', same.score >= 95, true);
const flat = compare(experience(), experience({
  pageHeightVh: 4, hero: 32, tracking: '0px', nav: 'static', blur: false, sections: 4, height: 0.6, dark: false,
  heading: 30, media: 0, reveal: 0, scrub: 0, pinned: 0, sticky: 0, videos: 0,
}));
check('feel: flat template scores < 60 (FAIL)', flat.score < 60, true);
check('feel: flat template lists motion gaps', flat.gaps.some((g) => g.startsWith('Scroll reveals')), true);

// --- shipped browser code parses ---
let probeParses = true;
try { new Function(readFileSync(path.join(SKILL, 'scripts', 'probe.js'), 'utf8')); } catch { probeParses = false; }
check('probe.js parses', probeParses, true);
const motion = await import('data:text/javascript,' + encodeURIComponent(readFileSync(path.join(SKILL, 'assets', 'motion.js'), 'utf8')));
check('motion.js exports initMotion', typeof motion.initMotion, 'function');
const chrome = findChrome();
check('findChrome returns a path or null', chrome === null || typeof chrome === 'string', true);
console.log(`      (browser for capture on this machine: ${chrome || 'none found'})`);

// --- originality end to end ---
const dir = mkdtempSync(path.join(tmpdir(), 'riff-selftest-'));
try {
  const ref = {
    tool: 'riff', host: 'www.examplebrand.test',
    brand: { terms: ['examplebrand', 'ExampleBrand'] },
    colors: { signature: [{ hex: '#533afd', count: 10 }] },
    fonts: {
      families: [{ value: 'Brandsans', count: 40 }],
      faces: [{ family: 'Brandsans', host: 'self', selfHosted: true, open: false }],
    },
    assets: {
      items: [{ url: 'https://cdn.examplebrand.test/img/hero-waves-2026.webp', name: 'hero-waves-2026.webp', logo: false }],
      hosts: ['cdn.examplebrand.test'],
    },
    text: {
      headings: [{ level: 1, text: 'Financial plumbing for ambitious internet companies' }],
      blocks: ['Accept payments, send payouts and automate finance with one flexible platform built for scale.'],
    },
  };
  const refPath = path.join(dir, 'reference.json');
  const outPath = path.join(dir, 'out.json');
  writeFileSync(refPath, JSON.stringify(ref));

  const bad = path.join(dir, 'bad');
  mkdirSync(path.join(bad, 'public'), { recursive: true });
  writeFileSync(path.join(bad, 'index.html'), `<style>body{font-family:"Brandsans",sans-serif}.cta{background:#533afd}</style>
<h1>Financial plumbing for ambitious internet companies</h1>
<p>Accept payments, send payouts and automate finance with one flexible platform built for scale.</p>
<img src="https://cdn.examplebrand.test/img/hero-waves-2026.webp"><footer>Like ExampleBrand</footer>`);
  writeFileSync(path.join(bad, 'public', 'hero-waves-2026.webp'), '');

  const good = path.join(dir, 'good');
  mkdirSync(good, { recursive: true });
  writeFileSync(path.join(good, 'index.html'), `<style>body{font-family:"Hanken Grotesk",sans-serif;transition:opacity .2s linear}.cta{background:#0f9d76}</style>
<h1>Invoices your clients actually open</h1><p>Send, track and get paid without chasing anyone.</p>`);
  writeFileSync(path.join(good, 'DESIGN.md'), 'Inspired by the design language of examplebrand.test.');

  const run = (project) => {
    let code = 0;
    try {
      execFileSync(process.execPath, [ORIGINALITY, '--ref', refPath, '--project', project, '--out', outPath], { stdio: 'pipe' });
    } catch (err) {
      code = err.status;
    }
    return { code, out: JSON.parse(readFileSync(outPath, 'utf8')) };
  };

  const b = run(bad);
  const flagged = new Set(b.out.findings.map((f) => f.check));
  check('originality: copied project fails', b.code, 1);
  for (const c of ['copied-text', 'brand-term', 'hotlinked-asset', 'reused-asset', 'proprietary-font', 'signature-color']) {
    check(`originality: flags ${c}`, flagged.has(c), true);
  }
  const g = run(good);
  check('originality: original project passes', g.code, 0);
  check('originality: original project verdict', g.out.verdict, 'PASS');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);

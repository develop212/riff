---
name: riff
description: Design a website "in the style of" another site without cloning it. Use when the user types /riff <url>, or says "make it look like <site>", "design it like <site>", "inspired by <site>", "the vibe of <site>", or wants to mix styles ("Linear's layout with Stripe's colors"). Captures how the reference feels (section rhythm, type scale, media, scroll motion, pinned stories) and its design tokens, rebuilds that experience for the user's own brand with an original identity, then checks both that it feels like the reference and that nothing was copied. Not for pixel-perfect cloning, impersonation, or recreating login/checkout pages of real brands.
argument-hint: <url> [more urls] [for "what you're building"]
---

# riff: feel like a site, without copying it

A musician riffs on a song: same feel, new melody.

riff has two jobs, and both are checked before you hand off:

| **Match the experience** (free to learn from) | **Change the identity** (belongs to them) |
|---|---|
| Section rhythm, page length, dark/light flow | Name, logo, favicon, product names |
| Type scale, weights, tracking, spacing | Their exact signature accent color |
| How much is media; full-bleed vs contained | Their photos, video, illustrations, icons |
| Scroll motion: reveals, scrubs, pinned stories | Their copy and headlines |
| Nav behaviour, hover style, timing and easing | Their proprietary fonts, their source code |

The most common failure is a site that is "original" because it's generic: a
template with the reference's colors swapped. That is a failed riff. Originality
comes from the identity column, never from flattening the experience column.

```
1. Gate     legitimate "inspired by" request?
2. Capture  tokens + experience (browser) → .riff/
3. Distill  .riff/DNA.md: experience spec + identity to replace
4. Build    section by section from the map, motion runtime, real media
5. Check    feel.mjs (must PASS) + originality.mjs (no FAIL) + visual compare
```

`<skill-dir>` means the directory containing this SKILL.md.

## Parse the request

`/riff <url> [<url> ...] [for "<what they're building>"]`

- Several URLs or "layout from A, colors from B": blend; assign each axis to one reference.
- If you don't know what they're building or their brand, ask once, in one sentence.
- A site name without a URL ("like Notion"): resolve it to the homepage yourself.
- Big brands' homepages are often catalogue pages; the signature feel is on product
  pages (e.g. a product's own page). If the user says "feel like X" and X's homepage
  probe shows little motion, say so and offer a product page as the reference.

## 1. Gate

Read [references/legal-guardrails.md](references/legal-guardrails.md) once per session.
Refuse in one sentence, and offer the riff instead, when asked to: recreate a real
brand's login, signup, checkout, payment or account page; make something users could
mistake for the reference brand; produce a pixel-perfect or 1:1 copy; or capture pages
behind a login, paywall or bot check.

## 2. Capture

```bash
node <skill-dir>/scripts/extract.mjs <url> --out .riff
```

It honours robots.txt and TDM opt-outs, fetches one page plus its stylesheets
(≤ 30 requests) and never crawls. Exit 3 = the site opted out (respect it), 4 = blocked,
5 = redirect stub (rerun on the printed URL). Use `--own-site` only for a site the
user owns. Add `.riff/` to `.gitignore`.

**The experience needs a real browser, and nothing has to be installed.** `extract.mjs`
drives the browser already on the machine (Chrome, Edge, Brave or Chromium) headless,
with a throwaway profile (no cookies or logins), on Node 22+. It uses Playwright
instead if the project happens to have it. Check the first line of the output:
`mode: browser (…)` means motion was captured.

If it says `static` (old Node, or no Chromium-family browser):

1. **Your own browser tool** (in-app browser, Chrome extension, devtools MCP): open the
   URL, run the contents of `<skill-dir>/scripts/probe.js` in its JavaScript tool, save
   the returned JSON as `.riff/experience.json`, rerun `extract.mjs <url> --out .riff
   --experience .riff/experience.json`, and take screenshots at the top and 3–4 scroll
   depths.
2. **The user's browser**: ask them to paste `probe.js` into the devtools console on the
   reference page and send you the output, plus a few screenshots.
3. **Neither**: work from screenshots or a screen recording, and say plainly that the
   motion couldn't be measured and the feel check can't run.

Without the experience data the build will feel generic, so don't skip this.

Then **look** at the screenshots. Numbers give you the system; screenshots give you
the art direction.

## 3. Distill

Fill in [references/design-dna.md](references/design-dna.md) as `.riff/DNA.md`. It
has two halves: the **experience spec** (section map, motion spec, media plan, type
scale) that you will match, and the **identity list** that you will replace.

## 4. Build

Read [references/motion-playbook.md](references/motion-playbook.md),
[references/transform-rules.md](references/transform-rules.md) and
[references/font-swaps.md](references/font-swaps.md) first.

1. Write the user's `DESIGN.md` (outline in transform-rules.md).
2. Copy `<skill-dir>/assets/motion.js` and `motion.css` into the project and start
   them once (motion-playbook §2). Tune its variables from the DNA's timing.
3. Build **section by section from the section map**: same count (±20%), heights,
   tone sequence, heading sizes, media share, and column structure. Never fall back to
   a hero + 3 cards + testimonials template unless the map shows it.
4. Add the motion the probe found: reveals on most headings, copy and media; a
   `data-pin` story for each pinned section; `data-scrub` where it scrubbed.
5. Media: large, art-directed visuals wherever the reference has them (playbook §4).
   Ask the user for product media, use an image generator if you have one, or pick one
   coherent set of licensed stock. Never gray boxes.
6. Identity: new accent, open-licence fonts, original copy, own assets (transform-rules).
7. Use the project's stack. With no project, build a single static `index.html` +
   `riff-motion/` folder that runs with any static server.

## 5. Check (iterate until both pass, up to 3 rounds)

Serve the build locally, then:

```bash
node <skill-dir>/scripts/extract.mjs http://localhost:<port> --own-site --out .riff/build
node <skill-dir>/scripts/feel.mjs --ref .riff/reference.json --build .riff/build/reference.json
node <skill-dir>/scripts/originality.mjs --ref .riff/reference.json --project .
```

- **feel.mjs** scores hero scale, rhythm, media, motion, nav and headings (PASS ≥ 75)
  and lists the exact gaps ("Scroll reveals: reference 93, build 4"). Close them.
- **originality.mjs** must show no FAIL. Fix or justify each WARN. It skips
  `DESIGN.md`, `README.md` and `.riff/`. Use `--ignore-term <name>` only when the build
  legitimately integrates the reference as a product, and say so.
- **Visual**: compare `.riff/shot-*.png` with `.riff/build/shot-*.png` and answer the
  questions in [references/originality-check.md](references/originality-check.md):
  the feel test should say yes; the squint, logo-swap and signature tests should say no.

To serve a static build: `npx serve .` or `python3 -m http.server`. If no browser
capture is possible, say that the feel check didn't run.

Write `.riff/RIFF-REPORT.md` (template in originality-check.md) and tell the user
briefly: what you matched, what you changed, both check results, which media is
placeholder, and one line: "riff reduces risk but isn't legal advice. If this site
competes directly with the reference, get a quick review from a lawyer."

## Principles

- Proportion, rhythm, media and motion are the feel. Spend the effort there.
- Better than the reference is allowed: keep WCAG AA, respect reduced motion.
- If you're unsure whether something is experience or identity, treat it as
  identity and change it. But never "make it different" by making it worse.

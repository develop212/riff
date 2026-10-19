# riff

**Design like any website. Without copying it.**

```
/riff linear.app
/riff stripe.com for "an invoicing app called Ledgerly"
/riff vercel.com and notion.so — layout from the first, type from the second
```

riff is an agent skill for Claude Code (and other agents that read `SKILL.md`)
that lets you say "make my site feel like *that* one." It opens the reference in a
real browser and measures how it **feels**: section rhythm, type scale, how much is
media, and every scroll reveal, scrubbed animation and pinned scroll story. It
rebuilds that experience for your brand with a new identity (colors, fonts, copy,
assets), then checks both directions: that it **feels** like the reference, and
that nothing was **copied**.

A musician riffs on a song: same feel, new melody.

---

## Why riff instead of a cloner?

Cloning a site gets you a copy of someone else's brand. That's a legal problem
(copyright, trade dress, design rights, font licences), and it also looks
derivative. What you usually want is the *feel*.

| | Website cloners | Token extractors | Prebuilt brand `DESIGN.md` packs | **riff** |
|---|---|---|---|---|
| Works on any public URL | ✅ | ✅ | ❌ curated brands only | ✅ |
| Builds the site for you | ✅ (a copy) | ❌ you apply the tokens | ❌ | ✅ (an original) |
| Measures scroll motion, pinned stories, section rhythm | ❌ | ❌ | ❌ | ✅ |
| Scores whether the build *feels* like the reference | ❌ | ❌ | ❌ | ✅ |
| Changes brand identity (accent, fonts, signature elements) | ❌ | ❌ | ❌ | ✅ |
| Blocks copied text, logos, assets, proprietary fonts | ❌ | ❌ | ❌ | ✅ |
| Automated originality check before hand-off | ❌ | ❌ | ❌ | ✅ |
| Honours robots.txt and TDM opt-outs | varies | varies | n/a | ✅ |
| Refuses brand-styled login/checkout pages | varies | n/a | n/a | ✅ |
| Dependencies | Node + Playwright | Node + Playwright | none | **None.** Node 22+ and the Chrome/Edge/Brave you already have |

riff builds on good ideas from the projects in this space. If you want a
pixel-exact migration of **your own** site, a cloner is the right tool. If you want a
token file for your own pipeline, a token extractor is. riff is for "I want my
site to feel like that one, and I want it to be mine."

## Install

**Claude Code: personal skill (gives you `/riff`)**

```bash
git clone https://github.com/develop212/riff.git
mkdir -p ~/.claude/skills && cp -R riff/skills/riff ~/.claude/skills/riff
```

**Claude Code: plugin (gives you `/riff:riff`)**

```
/plugin marketplace add develop212/riff
/plugin install riff@riff
```

**Any agent supported by the `skills` CLI (Claude Code, Codex, Cursor, OpenCode...)**

```bash
npx skills add develop212/riff
```

You can also just ask in plain words ("make it feel like linear.app") and the
agent will pick up the skill.

## How it works

riff keeps two lists apart:

| **Match the experience** | **Change the identity** |
|---|---|
| Section rhythm, page length, dark/light flow | Name, logo, product names |
| Type scale, weight, tracking, spacing | Signature accent color |
| How much is full-bleed media | Photos, video, illustrations, icons |
| Scroll reveals, scrubs, pinned stories, nav | Copy, proprietary fonts, source code |

```
1. Gate      refuse impersonation, brand-styled login/checkout pages, exact copies
2. Capture   extract.mjs: tokens from CSS + probe.js in a real browser → section map,
             hero type, nav, motion (reveals / scrubs / pinned / sticky / video),
             one screenshot per section
3. Distill   .riff/DNA.md: experience spec to MATCH + identity list to REPLACE
4. Build     section by section from the map, with the bundled motion runtime
             (data-reveal, data-scrub, data-pin), real media, a new identity
5. Check     feel.mjs scores hero / rhythm / media / motion / nav (PASS ≥ 75) and
             lists the gaps; originality.mjs fails on copied text, brand names,
             reused assets, proprietary fonts; then a side-by-side visual check
```

What you end up with:

- your site, in your existing stack (or a static `index.html` if you have none);
- `DESIGN.md`, your own design system, so future changes stay consistent;
- `.riff/` (git-ignored): captures, screenshots, DNA, and both check reports.

### The scripts on their own

```bash
# capture a page (drives your installed Chrome/Edge/Brave headless; nothing to install)
node skills/riff/scripts/extract.mjs https://example.com --out .riff

# capture your running build, then score the feel
node skills/riff/scripts/extract.mjs http://localhost:3000 --own-site --out .riff/build
node skills/riff/scripts/feel.mjs --ref .riff/reference.json --build .riff/build/reference.json

# check nothing was copied
node skills/riff/scripts/originality.mjs --ref .riff/reference.json --project .
```

`feel.mjs` and `originality.mjs` exit with `1` on FAIL, so you can run them in CI.

Browser capture runs headless in a throwaway profile (no cookies, logins or
extensions) and deletes it afterwards. It uses Playwright instead if your project
has it, and `CHROME_PATH` points it at any other Chromium browser. No Chromium
browser, or Node older than 22? Paste `scripts/probe.js` into any browser's devtools
console on the reference page and pass the output with `--experience probe.json`.

## What riff will and won't do

**Will:** learn from any public page; blend several references; carry over type
scales, spacing, color relationships, layout patterns and motion timing; fix the
reference's accessibility problems instead of inheriting them.

**Won't:** copy text, logos, images, icons, illustrations, video, or source code;
use the reference's brand name or proprietary fonts; build login, signup,
checkout or payment pages styled after a real brand; capture pages behind a
login, paywall or bot check; ignore `robots.txt` or text-and-data-mining
opt-outs; crawl a whole site.

## Legal

riff is designed to keep you on the "inspiration" side of the line, but it's a
tool, not a lawyer. Read **[LEGAL.md](LEGAL.md)**: it covers copyright, trade
dress, EU design rights (which now explicitly cover GUIs), font licences, and
scraping rules, with sources.

**Site owners:** to opt out of riff captures, add this to your `robots.txt`:

```
User-agent: riff
Disallow: /
```

riff also honours `tdm-reservation` (header, meta tag, or `/.well-known/tdmrep.json`).

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please don't add
captured data, screenshots, or `DESIGN.md` files of real brands to this repo.

Run the self-test (no network needed):

```bash
node tests/selftest.mjs
```

## Trademarks

Site names in this README are examples of public websites. They are used only
to identify them. riff is not affiliated with, sponsored by, or endorsed by any
of them, and all trademarks belong to their owners.

## License

[MIT](LICENSE)

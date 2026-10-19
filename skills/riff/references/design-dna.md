# Design DNA

The DNA is the *system* behind a site's look: proportions, rhythm, relationships.
It is what you can carry over. Write it to `.riff/DNA.md` (one per reference when
blending: `.riff/<name>/DNA.md`).

## How to read the extractor output

`summary.md` gives ranked lists. Read them like this:

- **Colors** — ignore near-whites and near-blacks for identity; everyone shares
  them. The top 1–3 *chromatic* colors are the brand signature. Note the
  **relationship** (e.g. "one saturated violet on near-black, used only for CTAs
  and links") — that's what you take. The hex values are what you leave.
- **Font sizes** — find the body size (most frequent 14–18px), then the display
  sizes. Divide neighbours to get the scale ratio (1.125 minor second, 1.2 minor
  third, 1.25 major third, 1.333 perfect fourth, 1.5, 1.618). Big jumps between
  body and h1 (≥ 3×) mean "editorial / dramatic"; small jumps mean "app-like".
- **Spacing** — look for a base unit (4 or 8). Note section padding (often
  64–160px); generous section padding is a big part of a "premium" feel.
- **Radius** — 0–2px sharp/technical, 4–8px neutral, 12–24px friendly, 9999px pills.
- **Shadows** — none or hairline borders → flat, technical; large soft blurs with
  low opacity → airy, product-y; hard offset shadows → playful/brutalist.
- **Motion** — durations under 200ms feel snappy; 300–600ms feel smooth or
  luxurious. Custom cubic-beziers suggest a team that cares about motion.
- **Font faces** — `selfHosted: true` usually means a licensed or custom font.
  That font gets swapped (font-swaps.md). Note its *category* (geometric sans,
  grotesk, humanist, serif, mono) and *personality* to pick a replacement.
- **Brand terms** — the site's own name and product words. These must not
  appear in the user's build.

Screenshots fill the gaps the numbers miss: density, whitespace, image style,
how much is text vs. visuals, and the hero composition.

## Reading the Experience section

`summary.md → ## Experience` comes from the browser probe. It is the most
important part of the capture:

- **Section map**: one row per section. Height in screens (≥ 1.5 = a scroll
  story), tone (dark/light), heading px, how many large media, columns, sticky, and
  how many motion items. This *is* the page plan.
- **Motion**: counts of scroll reveals (one-time entrances), scrubbed motion (tied to
  scroll position), pinned sections (stage stays while you scroll), sticky sections,
  videos and canvases. **Motion types** says what moves (`opacity+y` = fade-up).
- **Typical timing**: durations and easings of the reveals. Copy these into motion.css.
- **Hero type / Nav**: the first impression. Hero px, weight and tracking matter a lot.

If the section says "NOT CAPTURED", stop and get a browser capture (SKILL.md stage 2)
or screenshots before building. Guessing the motion produces a template.

## DNA template

```markdown
# DNA — <reference host>   (captured <date>)

## Feel in one line
<e.g. "Cinematic product theatre: dark, huge type, full-bleed video, everything
fades up as you scroll, two long pinned stories.">

## Experience spec (MATCH)
### Section plan
| # | purpose in OUR page | height | tone | heading px | media | motion |
|---|---|---|---|---|---|---|
| 0 | hero: <our product> | 0.9 | dark | 80 | full-bleed video | fade-up headline, media fade |
| 1 | ... | 2.5 (pinned) | dark | 64 | product render scales up | data-pin=3, scrub scale+radius |
<one row per reference section, ±20%>

### Motion spec
- Reveals: <type> on <what>, <duration> <easing>, <distance>px, stagger <n>ms
- Scrubs: <what scales/moves with scroll>
- Pinned stories: <n>, each <screens> screens: <what changes inside>
- Nav: <fixed/sticky, blur, height>
- Hover: <what changes>
- Video: <n>, autoplay muted loop, where

### Media plan
<which sections need which visuals; source for each: user / generated / licensed stock / crafted>

## Take (systems)
- Type: <category> sans for UI, <category> for display; scale ratio ≈ <r>;
  body <n>px / line-height <lh>; display weights <w>; tracking <tight/normal>.
- Spacing: base <4/8>px; section padding ≈ <n>px; content max-width ≈ <n>px;
  grid <n> cols.
- Color relationships: <bg tone> background, <text contrast>, accent used for
  <what>; <n> accents total; gradients <none/subtle/hero only>.
- Shape: radius <values> → <personality>; borders <hairline/none>; shadows <style>.
- Layout patterns: <ordered list of section patterns on the page>.
- Motion: <durations>, <easing>, <what animates>.
- Density: <airy / balanced / dense>; imagery <product UI / photos / illustration / none>.

## Leave (identity — must change)
- Signature accent(s): <hex list> → replace
- Fonts: <font names> (<self-hosted/commercial/open>) → swap, or keep if open (alone)
- Brand terms: <names, product names>
- Signature elements: <e.g. "animated mesh gradient in hero"> → idea to reinterpret: <...>
- Assets: logos, photos, illustrations, icons — none carried over
- Copy: none carried over

## Accessibility notes
<contrast problems in the reference you should fix, not inherit>
```

## Blending several references

Add a short axis table to the top of the user's `DESIGN.md`:

```markdown
| Axis   | From         | Notes                    |
|--------|--------------|--------------------------|
| Layout | reference A  | bento grid, wide gutters |
| Type   | reference B  | serif display, 1.333     |
| Color  | user's brand | relationship from A      |
| Motion | reference A  |                          |
```

If two references conflict (A is dense, B is airy), the axis owner wins; don't
average them into mush. Blending is itself a strong originality move.

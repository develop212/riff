# Motion & feel playbook

The feel of a premium site lives in four things: **scale** (how big the type and media
are), **rhythm** (how sections alternate and breathe), **media** (how much of the
screen is image or video), and **motion** (what moves as you scroll). Tokens alone
give you none of them. This playbook turns the `## Experience` part of `summary.md`
into a build that feels the same.

These are experience patterns, not identity. Copying *that* sections fade up as
you scroll is fine. Copying their exact assets, copy and colors is not.

## 1. Build from the section map, never from a template

`summary.md → Section map` lists every section with its height, tone, heading size,
media, columns and motion count. Plan your page as the same number of sections
(±20%) with the same rhythm:

- **Height**: a 2.3-screen section is a scroll story, not a 600px block. Keep it tall.
- **Tone**: if the reference runs dark, dark, dark, then light, do the same with your palette.
- **Heading size**: use the section's heading px (±10%), not a generic `text-4xl`.
- **Large media**: if a section has large media, yours needs large media too (see §4).
- **Columns**: 1 column with centered or start-aligned type means editorial and calm.
  Don't turn it into a 3-card grid.

**Banned unless the section map shows them:** the "hero + 3 feature cards +
testimonial slider + pricing + CTA" template, icon-in-circle feature grids,
generic gradient blobs, stock "team smiling at laptop" photos.

## 2. Install the motion runtime

Copy `assets/motion.js` and `assets/motion.css` from the skill into the project
(e.g. `src/lib/riff-motion/`), then start it once on the client:

```html
<!-- plain HTML -->
<link rel="stylesheet" href="/riff-motion/motion.css">
<script type="module">
  import { initMotion } from '/riff-motion/motion.js';
  initMotion();
</script>
```

```tsx
// React / Next.js (App Router): a client component mounted once in the layout
'use client';
import { useEffect } from 'react';
import { initMotion } from '@/lib/riff-motion/motion.js';
import '@/lib/riff-motion/motion.css';
export function Motion() { useEffect(() => initMotion(), []); return null; }
```

For Astro, Vue or Svelte, call `initMotion()` in the client-side mount hook. If the
reference uses GSAP or Lenis (`Motion libraries` line) and the project already has
them, you may use them instead. Don't add heavy dependencies without asking.

## 3. Map what the probe found to attributes

| Probe says | Build with | Notes |
|---|---|---|
| `reveal: opacity+y` (the most common) | `data-reveal="up"` | Default for headings, copy, cards |
| `reveal: opacity` | `data-reveal="fade"` | Large media, full-bleed images |
| `reveal: scale` / `opacity+scale` | `data-reveal="scale"` | Product shots, tiles |
| `reveal: clip` | `data-reveal="clip"` | Image wipes |
| `reveal: x` | `data-reveal="left"` / `"right"` | Alternating rows |
| several reveals in one section | `data-reveal-stagger="80"` on the parent | Lists, grids, multi-line headings |
| `scrub: opacity+y` | `data-scrub="opacity:0,1@0,.35; y:60,0@0,.35"` | Copy that drifts in with scroll |
| `scrub: scale` on media | `data-scrub="scale:.86,1@0,.5; radius:28,0@0,.5"` | The "media grows to full-bleed" move |
| `pinned (N screens)` | `<section data-pin="N">` + `data-scrub` children | Scroll story: content changes while the stage stays |
| `sticky` sections | `position: sticky` (side text while media scrolls) | Common for spec or feature lists |
| videos | `<video autoplay muted loop playsinline>` with a poster | Needs real footage (see §4) |
| `blurred translucent` nav | `position: fixed; backdrop-filter: saturate(180%) blur(20px); background: rgb(... / .72)` | |

**Match the amount.** Aim for at least 70% of the reference's reveal count, and the
same number of pinned and scrubbed moments (±1). `feel.mjs` checks this.

**Match the timing.** Set `--riff-reveal-duration`, `--riff-reveal-distance` and the
eases in `motion.css` from `Typical timing` and `Motion tokens`. Defaults: calm,
premium sites use 700–1000ms with a soft ease-out and 24–48px travel. Snappy
product UIs use 200–400ms and 8–16px.

### A pinned scroll story

```html
<section data-pin="3" class="story">
  <div>  <!-- becomes the sticky stage -->
    <h2 data-scrub="opacity:0,1@0,.15; y:40,0@0,.15">Built for long days</h2>
    <img src="/media/device.webp" alt=""
         data-scrub="scale:.8,1@.1,.6; radius:32,0@.1,.6">
    <p data-scrub="opacity:0,1@.55,.75">Up to 22 hours on a single charge.</p>
  </div>
</section>
```

Use `--progress` on the section for anything else (gradients, counters, progress bars):
`background: color-mix(in oklch, var(--color-bg), var(--color-accent) calc(var(--progress) * 30%));`

### Hover and interaction

Use the reference's `Hover changes` line. Apple-style sites mostly change color and
underline, with no lifting cards. Playful sites translate and shadow. Use 150–250ms.

## 4. Media carries the feel

If the reference has large media in most sections, a text-only build will never
feel like it. In order of preference:

1. The user's own product images or video. Ask for them.
2. Images generated with an available image tool (product renders, abstract
   materials, lifestyle shots in the right mood). Keep a consistent art direction.
3. Free-licence stock (Unsplash, Pexels). Check the licence and pick one coherent set.
4. Crafted visuals: CSS/SVG product mockups, rich gradients with grain, or a canvas/WebGL
   scene if the reference uses canvases.

Never ship gray placeholder boxes or small icons where the reference has full-bleed
media. If you must use placeholders, make them full-size, art-directed, and tell the
user exactly which media to drop in.

## 5. Scale and type

- Hero type: within ±10% of the reference's hero px, same weight class, same tracking
  sign (tight negative tracking at display sizes is a big part of a "premium" feel).
- Section headings: use the px from the section map.
- Body copy: short lines (45–70ch), generous line height.
- Spacing: match the reference's section padding. Shrinking it is the fastest way to
  make a premium design feel like a template.

## 6. Accessibility and performance

- `motion.js` honours `prefers-reduced-motion`. Keep it that way.
- Animate only transform, opacity, filter and clip-path.
- Videos: `muted playsinline`, a poster image, and a visible pause control for anything
  longer than 5 seconds.
- Pinned sections must still make sense with motion off: all content readable in order.

# Transform rules — original identity, same experience

The goal: someone who knows the reference says "this feels like X", never "this
*is* X". You get there by replacing the **identity** completely while keeping the
**experience** (rhythm, scale, media, motion; see motion-playbook.md) intact.

Do **not** make it original by making it worse: no shrinking the type, cutting
the motion, shortening the sections, or swapping full-bleed media for a card grid.
Generic is not original. It's just generic.

## Identity: must change, every one

1. **New accent color.** Start from the user's brand color if they have one.
   Otherwise rotate the reference's signature hue by **≥ 30°** in OKLCH and keep a
   similar lightness and chroma, so the *energy* carries over and the identity
   doesn't. Secondary accents follow the same rotation.
   Neutrals (backgrounds, greys, text) may stay close; nudge their hue slightly
   toward the new accent so the palette feels cohesive.
2. **Open-licence fonts.** If the reference's fonts are self-hosted or commercial,
   pick a replacement from font-swaps.md matching category and personality. If they
   use an open font (e.g. Inter), you may keep it *only* if color and layout
   already differ clearly; otherwise pair it differently or pick a sibling.
3. **Original copy.** Write for the user's product. Match the reference's *tone
   and length* (e.g. "short, confident, 6-word headlines"), not its sentences.
4. **Original or licensed imagery.** User assets, generated images, free-licence
   stock (Unsplash, Pexels — check the licence), or tasteful placeholders. Icons
   from Lucide / Heroicons / Phosphor / Tabler.
5. **Fresh code.** Write the components yourself from the DNA numbers.
6. **Reinterpret signature elements.** A signature element is one people would
   recognise as that brand on sight (a specific animated gradient, a mascot, a
   trademark shape, their exact hero composition with their product). Keep the
   *idea* ("hero opens on a full-bleed, living visual that settles as you scroll")
   and give it your own expression (your product, your art direction, your shape).

## Composition: change at least one, never at the experience's expense

Pick one or more. Each keeps the rhythm, scale and motion but avoids a
section-for-section copy:

- Reorder sections or merge two (the section *types* and *count* stay similar).
- Mirror a composition (text left ↔ right, start-aligned ↔ centered).
- Tell a different story in a pinned section (different sequence, different
  visual), with the same length and the same kind of motion.
- Different grid inside a section (2 large tiles instead of 3, asymmetric split).
- A different radius or shadow language, if it suits the user's brand.

Blending two references counts as one.

**Off-limits as "changes":** fewer animations, shorter sections, smaller type,
less media, removing the dark/light rhythm, or a generic template. `feel.mjs` will
fail these, and that's the point.

## The user's DESIGN.md

Write this to the project root. It's the user's own design system, so the agent
(and future sessions) can keep the build consistent. Outline:

```markdown
# <User's brand> — Design System

> Inspired by the design language of <reference host(s)>. Original identity;
> not affiliated with or endorsed by them.

## 1. Visual theme
One paragraph: the feel, density, and personality.

## 2. Color
| Token | Value | Role |
|---|---|---|
| --color-bg | #... | page background |
| --color-surface | #... | cards, panels |
| --color-text | #... | primary text |
| --color-muted | #... | secondary text |
| --color-accent | #... | CTAs, links, focus |
| --color-accent-contrast | #... | text on accent |
| --color-border | #... | hairlines |
Contrast: list text/background pairs with their WCAG ratio (≥ 4.5:1 for body text).

## 3. Typography
Families (with licence), scale (ratio + px list), weights, line-heights, tracking.

## 4. Spacing & layout
Base unit, scale, container width, grid, section padding, breakpoints.

## 5. Shape & depth
Radius scale, borders, shadow tokens.

## 6. Components
Buttons (primary/secondary/ghost, sizes, states), inputs, cards, nav, footer.

## 7. Motion
Durations, easings, what animates, reduced-motion behaviour.

## 8. Do / Don't
5–8 bullets that keep future work on-brand.
```

The "Inspired by" credit belongs in `DESIGN.md` and the repo, not on the live
site: a credit on the public site can read as a claimed affiliation.

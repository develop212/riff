# Font swaps — proprietary → open licence

Many well-known sites use commercial or custom fonts. Copying the font files is a
licence breach even when the site serves them publicly. Swap them for an
open-licence font with a similar category and personality.

All replacements below are distributed under the SIL Open Font License (OFL) or
Apache 2.0 and are available on Google Fonts or npm. Licences can change; confirm
on the font's page before shipping. These are **similar in feel, not metric
clones**. Tune size and tracking after swapping.

## How to decide

1. `reference.json → fonts.faces[]` with `selfHosted: true` → assume licensed or
   custom → **swap**.
2. Font loaded from `fonts.googleapis.com` / `fonts.bunny.net` / Fontsource → open
   → may keep (but see transform-rules.md rule 2).
3. Only a system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`) → you
   may use the same system stack; it ships no font files.
4. Unknown font not listed below → identify its category, pick from the
   category table at the bottom.

## Common proprietary fonts

| Seen on reference | Category | Open-licence options |
|---|---|---|
| SF Pro / SF Pro Display (Apple, restricted licence) | neo-grotesk | system-ui stack, Inter, Geist |
| Helvetica / Helvetica Neue / Neue Haas Grotesk | neo-grotesk | Inter, Inter Tight, Arimo, Schibsted Grotesk |
| Söhne | grotesk | Inter, Geist, Instrument Sans |
| Graphik | grotesk | Inter, Work Sans, Hanken Grotesk |
| GT America | grotesk | Hanken Grotesk, Schibsted Grotesk, Public Sans |
| Neue Montreal / PP Neue Montreal | grotesk | Inter Tight, Hanken Grotesk |
| Circular / Circular Std | geometric | DM Sans, Plus Jakarta Sans, Figtree |
| GT Walsheim | geometric | Outfit, Lexend, Manrope |
| Gilroy | geometric | Plus Jakarta Sans, Urbanist, Outfit |
| Proxima Nova | geometric-humanist | Figtree, Montserrat, Mulish |
| Gotham | geometric | Montserrat, Outfit |
| Futura / Futura PT | geometric | Jost, Outfit |
| Avenir / Avenir Next | geometric-humanist | Nunito Sans, Mulish, Figtree |
| Brand-custom sans (company-named fonts, e.g. "<Brand> Sans") | varies | never reuse; pick by category |
| Tiempos / Tiempos Headline | serif | Newsreader, Source Serif 4 |
| Canela / GT Sectra | display serif | Fraunces, Playfair Display, Instrument Serif |
| Freight Text / Freight Display | serif | Literata, Source Serif 4, Newsreader |
| Commercial Garamonds | old-style serif | EB Garamond, Cormorant Garamond |
| SF Mono / Berkeley Mono / Operator Mono | mono | JetBrains Mono, Geist Mono, IBM Plex Mono |

## By category (when the font isn't listed)

| Category | Feel | Options |
|---|---|---|
| Neo-grotesk | neutral, Swiss, technical | Inter, Geist, Inter Tight |
| Grotesk | warm-neutral, editorial-tech | Hanken Grotesk, Schibsted Grotesk, Instrument Sans |
| Geometric | friendly, round, consumer | DM Sans, Plus Jakarta Sans, Outfit, Manrope |
| Humanist | soft, approachable | Nunito Sans, Source Sans 3, Mulish |
| Display serif | luxury, editorial | Fraunces, Playfair Display, Instrument Serif |
| Text serif | reading, journalism | Newsreader, Source Serif 4, Literata |
| Mono | dev, terminal | JetBrains Mono, Geist Mono, IBM Plex Mono |

## Tips

- Pick a different family from the same category rather than the closest
  look-alike. "Same category, different face" carries the feel without being a
  stand-in.
- Load via Google Fonts, Fontsource (`@fontsource/<name>`), or `next/font/google`.
  Self-hosting OFL fonts is allowed.
- A distinctive pairing (e.g. serif display + grotesk body) is a cheap, strong
  originality move.

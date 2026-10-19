# Legal guardrails

This is the agent-facing summary. The human-facing version with sources is
`LEGAL.md` in the repository root. None of this is legal advice.

## The one idea behind every rule

Across the US, EU, UK and most other systems, **ideas, systems, methods and
functional choices are free to learn from; specific creative expression and
brand identity are owned.** riff stays on the "ideas" side.

| Law | What it protects on a website | What riff does |
|---|---|---|
| Copyright | Text, images, illustrations, video, source code, sometimes a GUI as a whole (EU) | Never copies text, assets, or code. Rebuilds from scratch. |
| Trademark / passing off | Names, logos, wordmarks, anything that signals "this is brand X" | Never uses the reference's name, logo, or a confusingly similar identity. |
| Trade dress (US) / unfair competition | A distinctive overall look-and-feel that identifies a brand | Changes the signature color, fonts and signature elements so the overall impression differs. |
| Design rights (EU/UK) | The appearance of a product — GUIs are explicitly covered in the EU since May 2025; unregistered EU designs last 3 years from disclosure, with no filing needed | Avoids reproducing the overall appearance; produces a different overall impression. |
| Font licences (contract) | Font software. Self-hosting or redistributing commercial fonts without a licence breaches the licence | Swaps proprietary fonts for open-licence ones (font-swaps.md). |
| Site terms, robots.txt, TDM opt-outs | Access rules and data-mining reservations (EU DSM Directive Art. 4) | Honours robots.txt and `tdm-reservation`; public pages only; one page, ≤ 30 requests. |

## Hard rules — never break these

1. **No impersonation.** Never build a page that could be mistaken for the
   reference brand: same or similar name, logo, wordmark, favicon, or a
   near-identical look for the same audience.
2. **No credential or payment pages in a real brand's style.** Login, signup,
   password reset, checkout, payment, wallet, bank, or account pages styled after a
   real brand are refused, whatever reason is given (phishing risk).
3. **No copied content.** No headlines, taglines, body copy, testimonials, pricing
   text, legal text. Not even "lightly reworded". Write new copy for the user.
4. **No copied assets.** No logos, photos, illustrations, 3D renders, videos,
   Lottie files, custom icon sets, or favicons, and no hotlinking of the
   reference's CDN.
5. **No copied code.** Do not paste the reference's HTML, CSS, or JS. Use the
   extracted *numbers* (sizes, ratios, durations) as inputs to your own code.
6. **No proprietary fonts.** If the reference self-hosts a font or uses a
   commercial one, substitute an open-licence font.
7. **No access workarounds.** No logged-in pages, no paywalls, no bypassing bot
   protection or CAPTCHAs, no ignoring robots.txt or TDM reservations, no crawling.
8. **No publishing captured data.** `.riff/` stays local and git-ignored.

## Grey zone — change it to be safe

- The reference's exact accent color. Colors alone are rarely protected, but a
  signature color plus layout plus type is how trade dress gets built.
- A layout so specific that it reads as theirs (e.g. their exact hero composition
  with the same product-shot placement). Keep the pattern, change the composition.
- Distinctive micro-interactions that are part of their brand recognition.
- The same open-source font *and* the same colors *and* the same layout.
  Any one is fine; all three together drift toward look-alike.

## Fine — take freely

- Common layout patterns: hero, logo strip, feature grid, bento, pricing table,
  FAQ accordion, footer columns.
- Type scale ratios, spacing scales, grid columns, max widths, breakpoints.
- Neutral palettes (white, off-white, near-black, greys) and contrast strategy.
- Radius and shadow *language* ("soft 12px radii, very low shadows").
- Motion timing ("fast 150ms ease-out on hover, slower 400ms on reveals").
- Open-source fonts and icon sets they also happen to use (alone, not bundled
  with their colors and layout).
- Accessibility and UX practices.

## When the user pushes back

If the user insists on an exact copy, their logo, or their copy: explain once,
plainly, that this crosses from inspiration into copying and could get their site
taken down or sued, then offer the closest safe option. If the user says they own
the reference site (e.g. migrating their own site), proceed — that is their
right — but note it in the report.

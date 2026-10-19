# Originality check

Two halves: the automated scan (`scripts/originality.mjs`) and a visual check
you do yourself. Both must pass before you hand off.

## Automated scan — what it flags

| Check | Level | Meaning |
|---|---|---|
| `copied-text` | FAIL | A run of 6+ words from the reference's visible text appears in the project |
| `brand-term` | FAIL | The reference's brand/site name appears in project source or copy |
| `hotlinked-asset` | FAIL | The project loads files from the reference's domain or asset hosts |
| `reused-asset` | FAIL | A project file has the same name as a distinctive reference asset (logo, hero image, illustration) |
| `proprietary-font` | FAIL | A font the reference self-hosts is referenced in the project |
| `signature-color` | WARN | A chromatic project color is within ΔE 5 (OKLab) of a reference signature color; ΔE < 2 is reported as identical |
| `same-font-stack` | WARN | The project's primary font family equals the reference's (open font) |

Results are written to `.riff/originality.json` and printed as a list. Exit
code: `0` pass (possibly with warnings), `1` fail, `2` usage error.

False positives happen (a common phrase like "get started in minutes", or a brand
term that's also a normal word). If you're certain an item is a false positive,
say so in the report with the reason. Don't silence it by editing the reference
data. `--ignore-term <word>` exists for brand terms that are ordinary words.

## Visual check — answer honestly

Put a screenshot of your build next to the reference screenshot.

1. **Squint test.** Blur your eyes. Could someone mistake one for the other at a
   glance? → must be **no**.
2. **Logo-swap test.** If you pasted the reference's logo on your build, would it
   pass as one of their pages? → must be **no**.
3. **Signature test.** Is any element instantly recognisable as theirs (their
   gradient, illustration style, mascot, hero layout)? → must be **no**.
4. **Feel test.** Does it carry the qualities the user asked for (calm, premium,
   playful...)? → should be **yes**. This is the point of the riff.
5. **Better test.** Is it at least as accessible as the reference (contrast,
   focus states, reduced motion)? → should be **yes**.

Fail 1–3 → make another structural change (transform-rules.md) and check again.

## RIFF-REPORT.md template

```markdown
# riff report — <project>  (<date>)

References: <host A> (layout, motion), <host B> (type)

## Taken (ideas & systems)
- ...

## Changed (to make it original)
- Accent: <ref hex> → <new hex> (hue +<n>°)
- Fonts: <ref font> → <new font> (<licence>)
- Structure: <three or more changes>
- Signature element: <idea> reinterpreted as <...>

## Feel check (feel.mjs)
PASS <score>/100: hero <n> · rhythm <n> · media <n> · motion <n> · nav <n> · headings <n>
Remaining gaps: <none / list + why>

## Originality scan (originality.mjs)
PASS / WARN (<items + why acceptable>)

## Placeholder media to replace
<list, or "none">


## Visual check
1. Squint: no  2. Logo-swap: no  3. Signature: no  4. Feel: yes  5. Better: yes

## Notes
- Captured data in .riff/ is local only (git-ignored).
- riff reduces risk but is not legal advice.
```

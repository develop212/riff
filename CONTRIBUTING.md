# Contributing to riff

Thanks for helping. riff's whole point is "inspired by, never copied", so
contributions are judged on two things: does it make the designs better, and
does it keep users on the safe side of the line?

## Ground rules

- **No captured data in the repo.** No `reference.json`, screenshots, or
  `DESIGN.md` files extracted from real brands. Tests use synthetic fixtures.
- **No dependencies in the scripts.** `extract.mjs` and `originality.mjs` run on
  plain Node 18+. Playwright stays optional and is loaded from the user's project.
- **Guardrails only get stricter.** PRs that remove the robots.txt/TDM checks,
  the impersonation refusal, or originality checks won't be merged.
- **Keep `SKILL.md` under ~200 lines.** Detail goes in `references/`.

## Good first contributions

- More entries in `references/font-swaps.md` (with licence verified)
- Better heuristics in `extract.mjs` for CSS-in-JS and code-split sites
- Fewer false positives in `originality.mjs`
- Translating the docs

## Development

```bash
node tests/selftest.mjs                       # offline unit + fixture tests
node skills/riff/scripts/extract.mjs <url> --out /tmp/riff-test
node skills/riff/scripts/originality.mjs --ref /tmp/riff-test/reference.json --project <dir>
```

Please run the self-test before opening a PR and describe what you tested.

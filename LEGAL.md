# Legal notes

> **This is not legal advice.** It's a plain-language summary of the main legal
> issues around "design it like that site", written to explain why riff behaves
> the way it does. Laws differ by country and change. If your site competes
> directly with the site you're riffing on, or you're unsure, ask a lawyer.

## The short version

- **Learning from a site's design system is generally fine.** Layout patterns,
  spacing scales, type ratios, color *relationships* and interaction ideas are
  ideas and functional choices. Copyright doesn't protect ideas.
- **Copying expression and identity is not.** Text, images, illustrations, icons,
  video, source code, logos, brand names, licensed fonts, and a distinctive overall
  look that identifies a brand can all be protected.
- riff is built around that split: it takes the systems, leaves the identity,
  changes the signature elements, and checks the result.

## 1. Copyright

**United States.** The U.S. Copyright Office's Compendium treats a website as
layers: the content (text, photos, video), the selection and arrangement of that
content, and the underlying code. It lists the overall layout, format, and "look
and feel" of a website as not registrable. The content and the code *are*
protected. The Compendium is guidance rather than binding law, but courts often
follow it.

**European Union.** The Court of Justice held in *BSA v Ministerstvo kultury*
(C-393/09, 2010) that a graphical user interface can be protected by copyright as
a work if it is its author's own intellectual creation. So in the EU a
sufficiently original GUI *as a whole* can be protected, which is one more reason
riff changes the overall impression and not just the logo.

**What riff does:** never copies text, images, icons, illustrations, video, or
code; rebuilds everything from extracted numbers (sizes, ratios, durations);
the originality check fails on copied text and reused assets.

## 2. Trade dress, passing off, and unfair competition

A website's overall look can work like a brand. In *Blue Nile v. Ice.com*
(W.D. Wash. 2007), the court let a claim proceed that a competitor copied the
"look and feel" of Blue Nile's diamond-search pages as trade dress, while
dismissing state-law claims as preempted by copyright. That was an early-stage
ruling, not a final judgment, but it shows that "it's just the layout" isn't a
complete defence when a competitor's site looks confusingly similar. The UK
(passing off) and many civil-law countries (unfair competition) reach similar
results.

**What riff does:** refuses to build sites that could be mistaken for the
reference; requires a new accent color, different fonts where needed, and at
least three structural changes; reinterprets signature elements; runs a
"squint test" and "logo-swap test" before hand-off.

## 3. Design rights (EU and UK)

The EU's design-law reform (Regulation (EU) 2024/2822 and Directive (EU)
2024/2823) began applying on 1 May 2025, with more changes from 1 July 2026. It
explicitly includes **graphical user interfaces** in the definition of a
"product". An *unregistered* EU design protects a new design with individual
character for **3 years from first disclosure in the EU**, automatically, against
copying. Registered designs last longer. The UK has its own unregistered design
rights.

**What riff does:** the test for infringement is whether the result gives the
informed user a *different overall impression*. riff's transform rules and
visual check are aimed at exactly that.

## 4. Trademarks

Brand names, logos, wordmarks, and favicons are trademarks. Using them in a way
that suggests your site is, or is affiliated with, the reference brand is
infringement and can be fraud.

**What riff does:** never uses the reference's name, logo, or favicon; the
originality check fails if the brand name appears in the build. Naming the
inspiration in your private `DESIGN.md` or README is fine. Don't put it on the
live site, where it can read as a claimed affiliation.

## 5. Fonts

Typeface *designs* are generally not protected by copyright in the U.S., but
font *software* is, and commercial fonts come with licences that control
self-hosting, domains, page views, and conversion. A font being publicly served
by a website doesn't mean you can reuse the file.

**What riff does:** detects self-hosted and licensed font services; swaps them
for open-licence fonts (SIL OFL / Apache 2.0); the originality check fails if a
proprietary font from the reference shows up in your project.

## 6. Accessing the reference site

- **Public pages only.** riff never logs in, never captures paywalled pages, and
  never bypasses bot protection or CAPTCHAs.
- **Contract / terms of service.** In *Meta v. Bright Data* (N.D. Cal., January
  2024), the court found that scraping public data while logged out did not breach
  Meta's terms, because those terms governed account holders' use. The ruling is
  narrow and fact-specific. It doesn't make scraping lawful in general, and other
  sites' terms may be written differently.
- **EU text-and-data mining.** Article 4 of the DSM Directive (2019/790) allows
  text and data mining of lawfully accessible content *unless the rightsholder has
  reserved that right in an appropriate manner, such as machine-readable means*.
  National courts disagree on what counts (Dutch, German and Danish decisions in
  2024–2026 point in different directions). riff takes the conservative route.
- **Volume.** One page. Static mode fetches the page plus its stylesheets (at most
  30 requests). Browser mode loads the page once, exactly like a visitor, and scrolls
  it. No crawling, no repeated visits.
- **Motion and layout patterns.** Scroll reveals, pinned scroll stories, section
  rhythm and type scale are ideas and techniques, used across thousands of sites.
  riff measures them so you can build your *own* version; it never copies the
  reference's scripts, animation files or media.

**What riff does:** honours `robots.txt` (as the `riff` user agent, falling back
to `*`), honours `tdm-reservation` headers, meta tags, and `/.well-known/tdmrep.json`,
identifies itself honestly in its User-Agent, and stops with a clear message
when a site opts out. `--own-site` skips these checks and exists only for
analysing a site you own or have permission to analyse.

## 7. Impersonation and phishing

Building a login, signup, checkout, or payment page that looks like a real brand
is how phishing kits are made. It is illegal in essentially every jurisdiction
regardless of copyright.

**What riff does:** refuses these requests outright, whatever reason is given.

## 8. A note for the UAE and MENA

The UAE protects computer programs, apps, and creative works under Federal
Decree-Law No. 38 of 2021 on Copyrights and Neighbouring Rights, and trademarks
under Federal Decree-Law No. 36 of 2021. The same practical rules apply: don't
copy content, assets, code, or brand identity. Check with local counsel for
anything commercial.

## 9. For maintainers of this repository

- **Don't commit captured data.** No `reference.json`, screenshots, or
  brand-specific `DESIGN.md` files of real companies. Redistributing them
  reproduces other people's material; riff keeps captures local and git-ignored.
- **Brand names in docs** are used nominatively (to name a site), with a
  non-affiliation notice. Don't use logos or screenshots of real sites in the README.
- **The name.** "Riff" is a common word and is used by other products. Before you
  build a brand around it (logo, domain, paid product), run a trademark search
  (USPTO, EUIPO, WIPO Global Brand Database) in your target markets.
- **Licence.** MIT, with the standard no-warranty clause. Playwright is optional
  and not bundled.
- **Misuse reports.** If a site owner reports misuse, point them to the
  `robots.txt` opt-out and take reports seriously.

## Before you publish a riffed site: checklist

- [ ] `originality.mjs` passes (no FAIL) and every WARN is fixed or explained
- [ ] No text, images, icons, logos, or code from the reference
- [ ] Fonts are open-licence or properly licensed by you
- [ ] Accent color and signature elements are clearly different
- [ ] The squint test and logo-swap test from `originality-check.md` pass
- [ ] Nothing on the live site claims or implies affiliation with the reference
- [ ] If you compete directly with the reference: a lawyer has had a quick look

## Sources

- U.S. Copyright Office, *Compendium of U.S. Copyright Office Practices*, Third
  Edition, ch. 1000 (Websites): https://www.copyright.gov/comp3/ (summarised in
  https://www.robinskaplan.com/newsroom/insights/digital-media-and-the-new-us-copyright-office-practices)
- CJEU, C-393/09 *Bezpečnostní softwarová asociace v Ministerstvo kultury* (22 Dec 2010)
- *Blue Nile, Inc. v. Ice.com, Inc.*, 478 F. Supp. 2d 1240 (W.D. Wash. 2007):
  https://cyberlaw.stanford.edu/blog/2007/03/court-rules-copyright-preemption-trade-dress-infringement-and-state-law-claims
- EU design reform overview: https://www.pinsentmasons.com/out-law/analysis/eu-design-law-reform-explained-for-businesses
  and https://www.dreyfus.fr/en/2026/01/05/eu-design-protection-complete-guide-to-the-2025-reform/
- *Meta Platforms v. Bright Data* (N.D. Cal. 2024):
  https://www.quinnemanuel.com/the-firm/news-events/client-alert-what-does-the-meta-v-bright-data-summary-judgment-ruling-mean-for-web-scraping/
- DSM Directive Art. 4 TDM opt-outs and case law:
  https://ipkitten.blogspot.com/2025/02/dutch-court-holds-that-tdm-opt-out-must.html,
  https://legalblogs.wolterskluwer.com/copyright-blog/laion-round-2-machine-readable-but-still-not-actionable-the-lack-of-progress-on-tdm-opt-outs-part-1/
- W3C TDM Reservation Protocol (TDMRep): https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/
- Website trade dress overview: https://www.oneilltranlaw.com/post/inspiration-or-infringement-trade-dress-and-website-design
- Web font licensing overview: https://tryhoverify.com/blog/font-licensing-guide-for-web-developers

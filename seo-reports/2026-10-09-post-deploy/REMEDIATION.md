# Audit remediation — 9 October 2026

Deployed to https://fxnholdings.com with asset version `20261010g`. This addendum records fixes after the original audit; original evidence remains unchanged. Deployment includes uncommitted working-tree changes, so the deploy script's base Git revision alone is not a release identifier.

## Completed

- Corrected the VAT guide's blanket marketplace registration claim in both its short answer and detailed explanation. Sellers making only zero-rated deemed supplies may apply for exemption; import responsibilities and VAT recovery are distinguished. Source: [HMRC marketplace guidance](https://www.gov.uk/guidance/vat-and-overseas-goods-sold-to-customers-in-the-uk-using-online-marketplaces).
- Qualified the SS-4 line 7b instructions by eligibility for an SSN/ITIN, and qualified foreign BOI reporting by reporting-company status and exemptions. Replaced the outdated FinCEN PDF link with current guidance. Sources: [IRS SS-4 instructions](https://www.irs.gov/instructions/iss4), [FinCEN BOI guidance](https://www.fincen.gov/boi).
- Added a correction contact link to both guides. These edits do not establish that a qualified tax/legal professional reviewed the articles in full.
- Enlarged carousel button hit areas to 44×44px, retained small visual indicators, and added a visible keyboard focus outline.
- Added optional `updated` front matter for a visible update date and BlogPosting `dateModified`, preserving publication/RSS dates. Invalid update chronology fails the build. Both corrected guides show the actual update date, 9 October 2026.
- Removed build-day fallback dates from sitemap generation. Shared rendering dependencies now contribute to date checks; uncertain dates are omitted on dirty/untracked source builds. This deployed sitemap intentionally omits optional `lastmod` dates rather than claiming a new modification on each rebuild.
- Added regression tests and documented the date behavior in README.

## Verification

- `npm test`: all 11 tests pass, including metadata regression tests and prior API/deployment tests.
- Staging build: 24 pages; 19 sitemap URLs; `git diff --check` passes.
- Deployment health check succeeds. Live API returns `{"ok":true}`; asset version confirmed.
- Live crawl: all 19 sitemap URLs return 200, are indexable and self-canonical, have one H1 and parseable JSON-LD. Both corrected guides expose their visible update date and schema date.
- Browser tests at 390px and 1440px: all carousel targets 44×44px; click and Enter activation work; no horizontal overflow or page errors.
- Fresh homepage Lighthouse: performance 100, accessibility 100, best practices 100, SEO 100.
- Fresh article Lighthouse: performance 99, accessibility 100 (previously 96), best practices 100, SEO 100; target-size audit passes. LCP 1.9s, CLS 0, TBT 0ms. Lab measurements do not establish real-user Core Web Vitals or rankings.
- The default Python urllib user agent received HTTP 403; the crawl succeeded with a browser user agent, and Chromium/Lighthouse succeeded. This does not establish whether verified search bots are blocked; Search Console URL inspection remains the appropriate follow-up.

Evidence is under `evidence/remediation/`: Lighthouse JSON, browser checks and the live crawl. Neither post generator was changed.

## Remaining dependencies

- Full qualified review of the tax/business guides and genuine reviewer credentials.
- Substantiated portfolio case studies, requiring actual project outcomes and supporting business evidence.
- Search Console ownership/indexing/sitemap verification, requiring account access.

These are not automatically resolvable code errors. Existing email-delivery and paid AI end-to-end checks remain outside this verification.

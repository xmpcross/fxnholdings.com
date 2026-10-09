# Live performance and visual audit

Measured 9 October 2026, 20:00–20:03 AWST against https://fxnholdings.com after deployment. Fresh Lighthouse mobile lab runs; simulated throttling. These are lab measurements, not real-user Core Web Vitals certification.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 99 | 100 | 100 | 100 | 1.7s | 0.001 | 0ms |
| UK VAT article | 99 | 96 | 100 | 100 | 1.8s | 0 | 0ms |

Both pages had FCP and Speed Index of approximately 1.4s. Lighthouse SEO scores cover a limited set of technical checks, not ranking potential or content accuracy.

## Confirmed issue

Medium priority: Article featured-post carousel uses `.feat-dot` controls measuring 8×8px with insufficient spacing. Lighthouse flags three buttons under WCAG 2.2 target sizing. Expand actual clickable boxes to at least 24×24px, preferably 44×44px, while retaining the small visual dot through a pseudo-element. Evidence: article-lighthouse.json, audit `target-size`.

## Lower-priority opportunities

Homepage Lighthouse estimates 540ms potential render-blocking CSS savings; current lab LCP already passes the 2.5s threshold. Stylesheets include site.css, the Font Awesome subset and Lenis CSS. Treat any critical-CSS optimization as optional and guard against visual regressions. Cache lifetime guidance estimates only ~2KiB savings from extending CSS/JS caching; current one-week caching and explicit versioning already work.

## Browser verification

- Tested homepage and VAT article at 390×844 and 1440×1000.
- No horizontal overflow or JavaScript page errors on these pages.
- H1 visible above fold at both widths; homepage primary CTAs also visible.
- Mobile menu covers from y=60 to y=844 (784px high), backgrounds correctly, sets main content inert, and closes using Escape.
- Cookie notice and assistant launcher remain visually over the menu, though inert; low-priority visual polish opportunity if an uncluttered navigation overlay is wanted.
- Article TOC link updates hash and scrolls to its target with no runtime error.
- Some inline links are under 24px high; these alone do not establish accessibility failures because inline-text exemptions and spacing matter. The carousel dots are confirmed by automated checks.

## Evidence and limitations

Artifacts: evidence/performance/home-lighthouse.json, article-lighthouse.json, visual.json and screenshots. Full-page screenshots taken before scrolling contain initially hidden reveal sections, so blank areas in those captures are not evidence of missing content.

No CrUX/field INP data or Google API credentials available; TBT is a lab responsiveness metric and is not INP. Single lab run per URL; scores can vary. Desktop rendering was inspected, but desktop Lighthouse was not run. No live contact submission or paid AI request was made. Automated accessibility checks are not a complete manual accessibility audit.

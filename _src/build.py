#!/usr/bin/env python3
"""Build the static site.

Each file in _src/pages/ starts with a JSON metadata block in an HTML comment:

    <!--meta {"title": "...", "description": "...", "path": "/about/", "nav": "about"} -->

The body is wrapped in the shared head, header and footer, and written to the
output folder dist/ (path "/" -> index.html, "/about/" -> about/index.html, "/404.html" -> 404.html).
Everything in static/ (assets, fonts, images, robots.txt, _headers) is copied into dist/ first.
Insights posts in _src/posts/*.md become /insights/ pages (see _src/insights.py), and
sitemap.xml is generated. The Cloudflare Worker deploy runs this script and serves dist/.

Usage:  python3 _src/build.py            # live build (skips draft posts)
        python3 _src/build.py --drafts   # preview build into .dist-preview/ (includes drafts, marked "Draft")
"""
import datetime as dt
import json
import os
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import insights  # noqa: E402

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
OUT = Path(os.environ["BUILD_OUT"]).resolve() if os.environ.get("BUILD_OUT") else ROOT / "dist"
SITE = "https://fxnholdings.com"
VERSION = "20261010c"

logo = (SRC / "partials" / "logo.svg").read_text().strip()
header = (SRC / "partials" / "header.html").read_text()
footer = (SRC / "partials" / "footer.html").read_text()

# Category links are generated from the categories that have posts (set_category_links),
# so adding a category or its first post updates every list, and empty categories are not linked.
CATEGORY_LINKS = {}


def set_category_links(posts):
    cats = insights.used_categories(posts)
    CATEGORY_LINKS["{{LATEST_POSTS}}"] = insights.latest_section(posts)
    CATEGORY_LINKS["{{INSIGHTS_CATEGORY_LINKS}}"] = "\n".join(
        f'          <li><a href="/insights/{c["slug"]}/">{c["name"].replace("&", "&amp;")}</a></li>' for c in cats
    )
    CATEGORY_LINKS["{{INSIGHTS_CATEGORY_SITEMAP}}"] = "\n".join(
        f'        <li><a href="/insights/{c["slug"]}/">Blog: {c["name"].replace("&", "&amp;")} <i class="fa-solid fa-arrow-right chev" aria-hidden="true"></i></a></li>' for c in cats
    )


def fill(html):
    for key, value in CATEGORY_LINKS.items():
        html = html.replace(key, value)
    return html

ORG_JSONLD = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FXN Holdings",
    "url": SITE + "/",
    "logo": SITE + "/img/fxn-holdings-logo.svg",
    "description": "A digital venture group based in Perth, Western Australia, that finds market gaps, then builds and launches e-commerce, travel, content and publishing, price comparison and free online tool platforms on open-source technology.",
    "slogan": "Find the gap. Build. Launch.",
    "areaServed": "Worldwide",
    "email": "contact@fxnholdings.com",
    "taxID": "53 274 423 748",
    "sameAs": ["https://abr.business.gov.au/ABN/View?abn=53274423748"],
    "foundingDate": "2024",
    "address": {
        "@type": "PostalAddress",
        "postOfficeBoxNumber": "500",
        "addressLocality": "West Perth",
        "addressRegion": "WA",
        "postalCode": "6872",
        "addressCountry": "AU",
    },
}

HEAD = """<!doctype html>
<html lang="en-AU" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="FXN Holdings">
<meta property="og:locale" content="en_AU">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}{og_image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{og_image_alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{site}{og_image}">
{robots}<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="FXN Holdings Blog" href="/insights/feed.xml">
<link rel="preload" href="/fonts/Urbanist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/vendor/fontawesome/{fa_css}">
<link rel="stylesheet" href="/assets/vendor/lenis/lenis.css?v=1.3.26">
<link rel="stylesheet" href="/assets/site.css?v={version}">
{jsonld}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
"""

TAIL = """<script src="/assets/vendor/lenis/lenis.min.js?v=1.3.26" defer></script>
<script src="/assets/site.js?v={version}" defer></script>
</body>
</html>
"""


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def render_header(nav):
    out = header.replace("{{LOGO}}", logo)
    # Mark the current nav item
    return re.sub(
        r'data-nav="%s"' % re.escape(nav or "-"),
        'data-nav="%s" aria-current="page"' % (nav or "-"),
        out,
    )


def crumb_list(crumbs):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": name, "item": item} for i, (name, item) in enumerate(crumbs, 1)
    ]}


def render(meta, body):
    """Wrap a page body in the shared head, header and footer and write it to dist/."""
    path = meta["path"]
    url = SITE + ("/" if path == "/404.html" else path)

    graph = []
    if meta.get("jsonld"):
        graph = [ORG_JSONLD, {"@context": "https://schema.org", "@type": "WebSite", "name": "FXN Holdings", "url": SITE + "/", "inLanguage": "en-AU", "publisher": {"@type": "Organization", "name": "FXN Holdings"}}]
    elif not meta.get("noindex"):
        if meta.get("crumbs"):
            graph = [crumb_list(meta["crumbs"])]
        elif meta.get("crumb"):
            graph = [crumb_list([("Home", SITE + "/"), (meta["crumb"], url)])]
    graph += meta.get("jsonld_extra", [])
    jsonld = "".join('<script type="application/ld+json">%s</script>\n' % json.dumps(g, separators=(",", ":")) for g in graph)
    robots = '<meta name="robots" content="noindex">\n' if meta.get("noindex") else ""

    html = (
        HEAD.format(
            title=esc(meta["title"]),
            description=esc(meta["description"]),
            url=url,
            robots=robots,
            jsonld=jsonld,
            version=VERSION,
            site=SITE,
            fa_css=FA_CSS,
            og_type=meta.get("og_type", "website"),
            og_image=meta.get("og_image") or "/img/og-image.png",
            og_image_alt=esc(meta.get("og_image_alt") or "FXN Holdings: we find the gap, build the platform, and launch it."),
        )
        + render_header(meta.get("nav"))
        + '<main id="main">\n'
        + fill(body.replace("{{LOGO}}", logo)).strip()
        + "\n</main>\n"
        + fill(footer.replace("{{LOGO}}", logo))
        + TAIL.format(version=VERSION)
    )

    if path.endswith(".html"):
        out = OUT / path.lstrip("/")
    else:
        out = OUT / path.strip("/") / "index.html" if path != "/" else OUT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    return out.relative_to(OUT)


def read_page(src_path):
    raw = src_path.read_text()
    m = re.match(r"\s*<!--meta\s+(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        raise SystemExit(f"{src_path.name}: missing <!--meta {{...}} --> block")
    return json.loads(m.group(1)), raw[m.end():]


def pick_icon_css():
    """Use the cut-down Font Awesome (see subset_icons.py) only if it has every icon the site uses."""
    fa = ROOT / "static" / "assets" / "vendor" / "fontawesome"
    sub = fa / "fa.subset.css"
    if not sub.is_file():
        return "fa.min.css?v=6.7.2"
    have = set(re.findall(r"\.(fa-[a-z0-9-]+)\{--fa:", sub.read_text()))
    glyphs = set(re.findall(r"\.(fa-[a-z0-9-]+)\{--fa:", (fa / "fa.min.css").read_text()))
    used = set()
    for f in [*SRC.rglob("*.html"), *SRC.glob("*.py"), ROOT / "static" / "assets" / "site.js"]:
        text = f.read_text()
        used |= set(re.findall(r"\bfa-[a-z0-9]+(?:-[a-z0-9]+)*\b", text))
        used |= {"fa-" + n for n in re.findall(r'"icon":\s*"([a-z0-9-]+)"', text)}
    missing = sorted((used & glyphs) - have)
    if missing:
        print(f"warning: icons missing from fa.subset.css ({', '.join(missing)}); using the full fa.min.css. "
              "Re-run: /opt/scripts/fxnholdings/.venv/bin/python _src/subset_icons.py")
        return "fa.min.css?v=6.7.2"
    return f"fa.subset.css?v={VERSION}"


FA_CSS = "fa.min.css?v=6.7.2"


def last_changed(*paths):
    """Date of the last commit touching any of these files, for sitemap <lastmod>.
    Uncommitted edits count as today, so a preview or deploy of local changes stays honest."""
    import subprocess
    rel = [str(Path(x).resolve().relative_to(ROOT)) for x in paths]
    if subprocess.run(["git", "status", "--porcelain", "--", *rel], cwd=ROOT, capture_output=True, text=True).stdout.strip():
        return dt.date.today().isoformat()
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", *rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or dt.date.today().isoformat()


def sitemap(entries):
    rows = "".join(
        f"  <url><loc>{SITE}{path}</loc><lastmod>{lastmod}</lastmod></url>\n" for path, lastmod in entries
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}</urlset>\n'


if __name__ == "__main__":
    drafts = "--drafts" in sys.argv
    if drafts and not os.environ.get("BUILD_OUT"):
        # dist/ is the live site on this server; never write drafts into it.
        OUT = ROOT / ".dist-preview"
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "static", OUT)
    entries = []
    FA_CSS = pick_icon_css()
    posts = insights.load_posts(SRC, include_drafts=drafts)
    set_category_links(posts)
    for p in sorted((SRC / "pages").glob("*.html")):
        meta, body = read_page(p)
        print("built", render(meta, body))
        if not meta.get("noindex"):
            entries.append((meta["path"], last_changed(p)))
    post_files = {q["slug"]: SRC / "posts" / f"{q['slug']}.md" for q in posts}
    for meta, body in insights.pages(posts, SITE):
        print("built", render(meta, body))
        if not meta.get("noindex"):
            slug = meta["path"].strip("/").split("/")[-1]
            # A post changes when its file does; listings change when any post does
            files = [post_files[slug]] if slug in post_files else list(post_files.values()) or [SRC / "insights.py"]
            entries.append((meta["path"], last_changed(*files)))
    (OUT / "insights" / "feed.xml").write_text(insights.feed(posts, SITE))
    (OUT / "sitemap.xml").write_text(sitemap(entries))
    print(f"insights: {len(posts)} post(s){' incl. drafts' if drafts else ''}; sitemap: {len(entries)} URLs")

#!/usr/bin/env python3
"""Build the static site.

Each file in _src/pages/ starts with a JSON metadata block in an HTML comment:

    <!--meta {"title": "...", "description": "...", "path": "/about/", "nav": "about"} -->

The body is wrapped in the shared head, header and footer, and written to the
site root (path "/" -> index.html, "/about/" -> about/index.html, "/404.html" -> 404.html).

Usage:  python3 _src/build.py
"""
import json
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
SITE = "https://www.fxnholdings.com"
VERSION = "20261009b"

logo = (SRC / "partials" / "logo.svg").read_text().strip()
header = (SRC / "partials" / "header.html").read_text()
footer = (SRC / "partials" / "footer.html").read_text()

# Pages opt into the redesign with "theme": "v2" in their meta block. It swaps
# the stylesheet, fonts, theme colour, header and footer; site.js is shared.
THEMES = {
    None: {
        "css": "site.css",
        "theme_color": "#f3eee5",
        "fonts": ["Outfit-Regular.woff2", "Urbanist-Regular.woff2"],
        "header": header,
        "footer": footer,
    },
    "v2": {
        "css": "v2.css",
        "theme_color": "#ffffff",
        "fonts": ["Manrope-Variable.woff2", "InstrumentSans-Variable.woff2"],
        "header": (SRC / "partials" / "header-v2.html").read_text(),
        "footer": (SRC / "partials" / "footer-v2.html").read_text(),
    },
}

ORG_JSONLD = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FXN Holdings",
    "url": SITE + "/",
    "logo": SITE + "/img/fxn-holdings-logo.svg",
    "description": "An Australian digital holdings business that builds, acquires and operates online businesses across e-commerce, travel, content and publishing, price comparison and affiliate marketing.",
    "email": "kritin@fxnholdings.com",
    "taxID": "53 274 423 748",
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
<meta name="theme-color" content="{theme_color}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FXN Holdings">
<meta property="og:locale" content="en_AU">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary">
{robots}<link rel="icon" href="/icon.svg" type="image/svg+xml">
{preloads}<link rel="stylesheet" href="/assets/{css}?v={version}">
{jsonld}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
"""

TAIL = """<script src="/assets/site.js?v={version}" defer></script>
</body>
</html>
"""


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def render_header(header, nav):
    out = header.replace("{{LOGO}}", logo)
    # Mark the current nav item
    return re.sub(
        r'data-nav="%s"' % re.escape(nav or "-"),
        'data-nav="%s" aria-current="page"' % (nav or "-"),
        out,
    )


def build_page(src_path):
    raw = src_path.read_text()
    m = re.match(r"\s*<!--meta\s+(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        raise SystemExit(f"{src_path.name}: missing <!--meta {{...}} --> block")
    meta = json.loads(m.group(1))
    body = raw[m.end():]
    path = meta["path"]
    url = SITE + ("/" if path == "/404.html" else path)

    jsonld = ""
    if meta.get("jsonld"):
        jsonld = '<script type="application/ld+json">%s</script>\n' % json.dumps(ORG_JSONLD, separators=(",", ":"))
    robots = '<meta name="robots" content="noindex">\n' if meta.get("noindex") else ""
    theme = THEMES[meta.get("theme")]
    preloads = "".join(
        '<link rel="preload" href="/fonts/%s" as="font" type="font/woff2" crossorigin>\n' % f for f in theme["fonts"]
    )

    html = (
        HEAD.format(
            title=esc(meta["title"]),
            description=esc(meta["description"]),
            url=url,
            robots=robots,
            jsonld=jsonld,
            version=VERSION,
            theme_color=theme["theme_color"],
            preloads=preloads,
            css=theme["css"],
        )
        + render_header(theme["header"], meta.get("nav"))
        + '<main id="main">\n'
        + body.replace("{{LOGO}}", logo).strip()
        + "\n</main>\n"
        + theme["footer"].replace("{{LOGO}}", logo)
        + TAIL.format(version=VERSION)
    )

    if path.endswith(".html"):
        out = ROOT / path.lstrip("/")
    else:
        out = ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    return out.relative_to(ROOT)


if __name__ == "__main__":
    for p in sorted((SRC / "pages").glob("*.html")):
        print("built", build_page(p))

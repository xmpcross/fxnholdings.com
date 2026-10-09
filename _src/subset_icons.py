#!/usr/bin/env python3
"""Cut Font Awesome down to the icons this site uses.

The full kit is ~72 KB of CSS plus ~270 KB of fonts for a few dozen icons. This
script finds every `fa-<name>` the site uses (pages, partials, insights.py
including category icons, site.js), keeps only those glyph rules, and subsets
both fonts to their code points:

    static/assets/vendor/fontawesome/fa.subset.css
    static/assets/vendor/fontawesome/webfonts/fa-solid-900.subset.woff2
    static/assets/vendor/fontawesome/webfonts/fa-brands-400.subset.woff2

build.py links fa.subset.css only when every icon on the built pages is in it;
otherwise it falls back to the full fa.min.css and says so, so a new icon never
renders blank. Re-run this after adding icons.

Needs fonttools + brotli, installed in /opt/scripts/fxnholdings/.venv:
    /opt/scripts/fxnholdings/.venv/bin/python _src/subset_icons.py
"""
import re
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
FA = ROOT / "static" / "assets" / "vendor" / "fontawesome"
# fa- classes that are not glyphs
NOT_GLYPHS = {"fa-solid", "fa-brands", "fa-regular", "fa-fw", "fa-spin", "fa-xs", "fa-sm", "fa-lg", "fa-xl", "fa-2x"}
GLYPH_RULE = re.compile(r'((?:\.fa-[a-z0-9-]+,)*\.fa-[a-z0-9-]+)\{--fa:"\\([0-9a-f]+)"\}')


def used_icons():
    names = set()
    files = [*ROOT.joinpath("_src").rglob("*.html"), *ROOT.joinpath("_src").glob("*.py"), ROOT / "static" / "assets" / "site.js"]
    for f in files:
        text = f.read_text()
        names |= set(re.findall(r"\bfa-[a-z0-9]+(?:-[a-z0-9]+)*\b", text))
        names |= {"fa-" + n for n in re.findall(r'"icon":\s*"([a-z0-9-]+)"', text)}
    return names - NOT_GLYPHS


def main():
    css = (FA / "fa.min.css").read_text()
    used = used_icons()
    kept, codepoints = set(), set()

    def keep(m):
        selectors = m.group(1).split(",")
        hit = [s for s in selectors if s[1:] in used]
        if not hit:
            return ""
        kept.update(s[1:] for s in hit)
        codepoints.add(int(m.group(2), 16))
        return ",".join(hit) + '{--fa:"\\' + m.group(2) + '"}'

    out = GLYPH_RULE.sub(keep, css)
    for name in ("fa-solid-900", "fa-brands-400"):
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        font = subset.load_font(str(FA / "webfonts" / f"{name}.woff2"), opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=sorted(codepoints))
        sub.subset(font)
        subset.save_font(font, str(FA / "webfonts" / f"{name}.subset.woff2"), opts)
        out = out.replace(f"webfonts/{name}.woff2", f"webfonts/{name}.subset.woff2")
    (FA / "fa.subset.css").write_text(out)

    missing = sorted(used - kept)
    print(f"icons used: {len(used)}, kept: {len(kept)}, css {len(css)} -> {len(out)} bytes")
    for name in ("fa-solid-900", "fa-brands-400"):
        a, b = (FA / "webfonts" / f"{name}.woff2").stat().st_size, (FA / "webfonts" / f"{name}.subset.woff2").stat().st_size
        print(f"{name}: {a} -> {b} bytes")
    if missing:
        print("not Font Awesome glyphs (ignored):", ", ".join(missing))


if __name__ == "__main__":
    main()

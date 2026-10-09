#!/usr/bin/env python3
"""Generate Insights featured images with fal.ai and set them on the posts.

For each post in _src/posts/ that has an `image_prompt:` in its front matter,
this asks fal.ai (fal-ai/nano-banana-pro, 16:9, 2K) for an image, then writes

    static/img/insights/<slug>.webp      1600x900, shown on the card and the post page
    static/img/insights/<slug>-800.webp  800x450, the same image for phones and cards (srcset)
    static/img/insights/<slug>-og.jpg    1200x630, used for social sharing and Google

and sets `image: /img/insights/<slug>.webp` in the post's front matter.
`image_alt:` (also in the front matter) is the alt text; write it by hand.

Posts that already have an image are skipped unless you pass --force.
Each generated image is billed by fal.ai, so pass slugs to limit a run.

Needs FAL_KEY in the environment or in .env.local (FAL_KEY=...).

Usage:  python3 _src/featured_images.py                   # every post without an image
        python3 _src/featured_images.py how-we-use-ai     # just these posts
        python3 _src/featured_images.py --force how-we-use-ai   # replace an existing image
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
OUT = ROOT / "static" / "img" / "insights"
ENDPOINT = "fal-ai/nano-banana-pro"
# Shared art direction so every featured image belongs to the same set.
STYLE = (
    "Editorial illustration for a company blog header, wide 16:9 composition. "
    "Clean, modern and calm, with generous negative space. Palette: warm off-white #fcf6ef background, "
    "deep blue #0062de as the main accent, small touches of terracotta #a33c10 and soft yellow #f7bc3a, "
    "charcoal #2d2d2d for line work. Flat shapes with subtle paper grain and minimal gradients. "
    "Absolutely no text, letters, numbers, logos or watermarks anywhere in the image."
)


def fal_key():
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"]
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("FAL_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("FAL_KEY is not set: export it, or add FAL_KEY=... to .env.local")


def request(url, key, data=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Authorization": f"Key {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def generate(prompt, key):
    job = request(f"https://queue.fal.run/{ENDPOINT}", key, {
        "prompt": f"{prompt}\n\n{STYLE}",
        "aspect_ratio": "16:9", "resolution": "2K", "num_images": 1, "output_format": "png",
    })
    for _ in range(120):
        status = request(job["status_url"], key)["status"]
        if status == "COMPLETED":
            break
        if status not in ("IN_QUEUE", "IN_PROGRESS"):
            raise SystemExit(f"fal.ai job {job['request_id']} ended as {status}")
        time.sleep(2)
    else:
        raise SystemExit(f"fal.ai job {job['request_id']} timed out")
    result = request(job["response_url"], key)
    with urllib.request.urlopen(result["images"][0]["url"], timeout=120) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def front_matter(path):
    raw = path.read_text()
    m = re.match(r"---\n(.*?)\n---\n", raw, re.S)
    if not m:
        raise SystemExit(f"{path.name}: missing front matter")
    meta = dict(line.split(":", 1) for line in m.group(1).splitlines() if ":" in line)
    return raw, m, {k.strip(): v.strip() for k, v in meta.items()}


def set_image(path, raw, m, url):
    lines = [l for l in m.group(1).splitlines() if not l.startswith("image:")]
    lines.insert(next((i + 1 for i, l in enumerate(lines) if l.startswith("summary:")), len(lines)), f"image: {url}")
    path.write_text("---\n" + "\n".join(lines) + "\n---\n" + raw[m.end():])


def main(argv):
    force = "--force" in argv
    slugs = [a for a in argv if not a.startswith("--")]
    posts = sorted((SRC / "posts").glob("*.md"))
    if slugs:
        posts = [p for p in posts if p.stem in slugs]
        missing = set(slugs) - {p.stem for p in posts}
        if missing:
            raise SystemExit(f"no such post: {', '.join(sorted(missing))}")
    key = fal_key()
    OUT.mkdir(parents=True, exist_ok=True)
    for path in posts:
        raw, m, meta = front_matter(path)
        if meta.get("image") and not force:
            print(f"skip {path.stem}: already has {meta['image']} (use --force to replace)")
            continue
        if not meta.get("image_prompt"):
            print(f"skip {path.stem}: no image_prompt in front matter")
            continue
        if not meta.get("image_alt"):
            raise SystemExit(f"{path.name}: add image_alt (alt text) before generating")
        print(f"generating {path.stem} ...", flush=True)
        img = generate(meta["image_prompt"], key)
        ImageOps.fit(img, (1600, 900), Image.LANCZOS).save(OUT / f"{path.stem}.webp", "WEBP", quality=82, method=6)
        ImageOps.fit(img, (800, 450), Image.LANCZOS).save(OUT / f"{path.stem}-800.webp", "WEBP", quality=80, method=6)
        ImageOps.fit(img, (1200, 630), Image.LANCZOS).save(OUT / f"{path.stem}-og.jpg", "JPEG", quality=85, optimize=True, progressive=True)
        set_image(path, raw, m, f"/img/insights/{path.stem}.webp")
        print(f"  wrote static/img/insights/{path.stem}.webp and -og.jpg; set image on {path.name}")


if __name__ == "__main__":
    main(sys.argv[1:])

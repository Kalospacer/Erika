"""Induce a percentage template from a set of PSD banners.

The reference projects share one design theme but carry different artwork and
different copy, so their pixel values differ; what generalizes is the *relative*
geometry. This tool measures each PSD (icon smart object + text layers) and
emits the induced ratio set the `classic` template's `layout` block is pinned
to, together with the per-sample spread so the reader can see how tight each
rule is.

Usage:
    erika-psd induce <psd> [<psd> ...] [--out style-ratios.json]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from psd_tools import PSDImage

from . import __version__

# induced items: (label, per-sample extractor, induction)
#   mean  -- positions/sizes the designer kept consistent
#   max   -- text column right edge: widest sample, so every sample's
#            hand-made line breaks still fit the induced column
ITEMS = [
    ("icon.size", "icon", "mean"),
    ("icon.x", "icon", "mean"),
    ("icon.centerY", "icon", "mean"),
    ("title.x", "title", "mean"),
    ("title.inkTop", "title", "mean"),
    ("description.x", "description", "mean"),
    ("description.top", "description", "mean"),
    ("text.rightEdge", "text", "max"),
]


def measure(psd_path: str) -> dict:
    psd = PSDImage.open(psd_path)
    w, h = psd.width, psd.height

    icons = [l for l in psd.descendants() if l.kind == "smartobject" and l.visible]
    icon = max(icons, key=lambda l: l.width * l.height) if icons else None

    text = [l for l in psd.descendants() if l.kind == "type" and l.visible]
    title, desc = (text + [None, None])[:2]

    def ratio(num, den):
        return round(num / den, 4)

    sample = {
        "psd": psd_path,
        "canvas": [w, h],
        "icon": None if icon is None else {
            "bbox": [icon.left, icon.top, icon.right, icon.bottom],
            "size": [icon.width, icon.height],
            "ratios": {
                "size": ratio(icon.width, w),
                "x": ratio(icon.left, w),
                "centerY": ratio(icon.top + icon.height / 2, h),
            },
        },
        "title": None if title is None else {
            "bbox": [title.left, title.top, title.right, title.bottom],
            "ratios": {"x": ratio(title.left, w), "inkTop": ratio(title.top, h)},
        },
        "description": None if desc is None else {
            "bbox": [desc.left, desc.top, desc.right, desc.bottom],
            "ratios": {"x": ratio(desc.left, w), "top": ratio(desc.top, h)},
        },
        "text": None if (title is None or desc is None) else {
            "rightEdge": ratio(max(title.right, desc.right), w),
        },
    }
    sample["aspect"] = round(w / h, 4)
    return sample


def induce(samples: list[dict]) -> dict:
    induced: dict = {}
    spread: dict = {}
    for label, group, rule in ITEMS:
        key = label.split(".")[1]
        vals = []
        for s in samples:
            g = s.get(group)
            if not g:
                continue
            vals.append(g["ratios"][key] if "ratios" in g else g[key])
        if not vals:
            continue
        value = max(vals) if rule == "max" else sum(vals) / len(vals)
        induced[label] = round(value, 4)
        spread[label] = {
            "min": round(min(vals), 4), "max": round(max(vals), 4),
            "spread": round(max(vals) - min(vals), 4), "rule": rule,
        }
    induced["aspect"] = round(sum(s["aspect"] for s in samples) / len(samples), 4)
    return {"induced": induced, "spread": spread}


def run(psd_paths: list[str], out: str | None) -> dict:
    samples = [measure(p) for p in psd_paths]
    result = {
        "tool": {"name": "erika-psd-toolkit", "version": __version__, "command": "induce"},
        "samples": samples,
        **induce(samples),
    }
    if out:
        Path(out).write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="erika-psd induce",
                                     description="Induce percentage layout rules from reference PSDs")
    parser.add_argument("psd", nargs="+", help="reference .psd files (2 or more)")
    parser.add_argument("--out", help="write the ratio report as JSON")
    args = parser.parse_args(argv)

    result = run(args.psd, args.out)
    ind = result["induced"]
    print(f"induced from {len(result['samples'])} sample(s):")
    for label, value in ind.items():
        sp = result["spread"].get(label)
        extra = f"  (samples {sp['min']}..{sp['max']}, rule={sp['rule']})" if sp else ""
        print(f"  {label:<20} {value}{extra}")
    if args.out:
        print(f"-> {args.out}")
    return 0

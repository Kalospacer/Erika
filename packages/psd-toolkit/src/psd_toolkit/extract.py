"""PSD -> template extraction for Erika banners.

Extracts from a PSD file:
- canvas size
- background color (from the full-canvas pixel layer)
- icon smart object -> raw asset file
- text layers -> per-run styles (font / size / tracking / color / run lengths)
- diagnostics for anything not reproducible in a template

Outputs (under --out):
- assets/icon.<png|jpg>          raw smart-object content
- styles.json                    measured text-layer data (evidence)
- extraction-report.json         tool version, command, layers, and diagnostics
- template.draft.json            machine-draft for the final handwritten template
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
from pathlib import Path

from psd_tools import PSDImage
from psd_tools.psd.tagged_blocks import Tag

from . import __version__
from .engine import fill_color_hex, get, items_of, unwrap_str

SUPPORTED_LAYER_KINDS = ["pixel", "smartobject", "type", "group", "shape", "adjustment"]


def _effect_diagnostics(layer) -> list[dict]:
    """List enabled layer effects that the template draft will NOT reproduce."""
    found: list[dict] = []
    try:
        fx = layer.effects
        for item in fx:
            try:
                if not item.enabled():
                    continue
                found.append({
                    "type": type(item).__name__,
                    "size": getattr(item, "size", None),
                    "note": "effect present in PSD, not represented in template.draft.json",
                })
            except Exception as e:  # noqa: BLE001
                found.append({"type": type(item).__name__, "note": f"unreadable: {e!r}"})
    except Exception:
        pass
    return found


def _font_names(type_layer) -> list[str]:
    try:
        rd = type_layer.resource_dict
        names = []
        for f in get(rd, "FontSet") or []:
            name = get(f, "Name") if not isinstance(f, dict) else f.get("Name")
            names.append(unwrap_str(name) or "?")
        return names
    except Exception:
        return []


def _text_transform(layer) -> tuple[list[float] | None, float | None]:
    """TySh transform (xx, xy, yx, yy, tx, ty) and the effective font size.

    Photoshop stores font sizes in points and bakes the pt->px factor
    (document DPI / 72) into the transform; effective size = fontSize * scaleX.
    """
    try:
        tysh = layer._record.tagged_blocks.get_data(Tag.TYPE_TOOL_OBJECT_SETTING)
        t = tysh.transform
        xx, xy, yx, yy = t[0], t[1], t[2], t[3]
        import math
        sx = math.hypot(xx, xy)
        runs = []
        ed = layer.engine_dict
        sr = get(ed, "StyleRun")
        for run in get(sr, "RunArray") or []:
            sd_items = dict(items_of(get(get(run, "StyleSheet"), "StyleSheetData")))
            fs = getattr(sd_items.get("FontSize"), "value", sd_items.get("FontSize"))
            if isinstance(fs, (int, float)):
                runs.append(float(fs))
        size = runs[0] if runs else None
        return [round(v, 4) for v in (xx, xy, yx, yy)], round(size * sx, 2) if size else None
    except Exception:
        return None, None


def _extract_type_layer(layer) -> dict:
    transform, effective_size = _text_transform(layer)
    info: dict = {
        "layerName": layer.name,
        "text": layer.text,
        "bbox": [layer.left, layer.top, layer.right, layer.bottom],
        "fontsDeclared": _font_names(layer),
        "transform": transform,
        "effectiveFontSize": effective_size,
        "runs": [],
        "runLengths": [],
        "paragraphs": [],
        "diagnostics": [],
    }
    try:
        ed = layer.engine_dict
        sr = get(ed, "StyleRun")
        fonts = info["fontsDeclared"]
        for run in get(sr, "RunArray") or []:
            try:
                sd = get(get(run, "StyleSheet"), "StyleSheetData")
                sd_items = dict(items_of(sd))
                fi = sd_items.get("Font")
                info["runs"].append({
                    "font": fonts[fi] if isinstance(fi, int) and fi < len(fonts) else fi,
                    "fontSize": sd_items.get("FontSize"),
                    "tracking": sd_items.get("Tracking"),
                    "fillColor": fill_color_hex(sd_items.get("FillColor")),
                })
            except Exception as e:  # noqa: BLE001
                info["diagnostics"].append(f"style run unreadable: {e!r}")
        info["runLengths"] = [x for x in get(sr, "RunLengthArray") or []]
        try:
            pr = get(ed, "ParagraphRun")
            # real PSDs store paragraphs under ParagraphRun.RunArray
            arr = get(pr, "RunArray") or get(pr, "ParagraphRunArray")
            if arr is None:
                for k, v in items_of(pr):
                    if isinstance(v, list) or type(v).__name__ == "List":
                        arr = v
                        break
            for p in list(arr or []):
                props = get(get(p, "ParagraphSheet"), "Properties")
                p_items = dict(items_of(props))
                info["paragraphs"].append(
                    {k: p_items.get(k) for k in ("Justification", "Leading", "AutoLeading", "LeadingType")}
                )
            if not info["paragraphs"]:
                info["diagnostics"].append("paragraph data present but empty after extraction")
        except Exception as e:  # noqa: BLE001
            info["diagnostics"].append(f"paragraph properties unreadable: {e!r}")
            info["paragraphs"] = [{"error": repr(e)}]
    except Exception as e:  # noqa: BLE001
        info["diagnostics"].append(f"engine data unreadable: {e!r}")
    return info


def _extract_background(psd) -> tuple[dict, list[str]]:
    """Sample the full-canvas pixel layer for a uniform background color."""
    notes: list[str] = []
    for layer in psd:
        if layer.kind == "pixel" and layer.width == psd.width and layer.height == psd.height:
            try:
                img = layer.topil()
                if img is None:
                    continue
                rgb = img.convert("RGB")
                points = [(10, 10), (psd.width - 11, 10), (10, psd.height - 11),
                          (psd.width - 11, psd.height - 11), (psd.width // 2, psd.height // 2)]
                samples = [rgb.getpixel(p) for p in points]
                if len(set(samples)) == 1:
                    r, g, b = samples[0]
                    return {"color": f"#{r:02X}{g:02X}{b:02X}", "layer": layer.name,
                            "uniform": True}, notes
                notes.append(f"background layer {layer.name!r} is not uniform: {samples}")
                return {"color": None, "layer": layer.name, "uniform": False}, notes
            except Exception as e:  # noqa: BLE001
                notes.append(f"background sample failed on {layer.name!r}: {e!r}")
    notes.append("no full-canvas pixel layer found; background color not extracted")
    return {"color": None, "layer": None, "uniform": False}, notes


def _extract_icon(psd, out: Path) -> dict | None:
    """Export the largest *visible* smart-object layer's raw content.

    PSDs may carry leftover hidden icons (e.g. an old project's artwork kept
    on a hidden layer); invisible layers are skipped and inventoried instead.
    """
    (out / "assets").mkdir(parents=True, exist_ok=True)
    candidates = [l for l in psd.descendants()
                  if l.kind == "smartobject" and l.visible]
    all_so = [{"name": l.name, "bbox": [l.left, l.top, l.right, l.bottom],
               "size": [l.width, l.height], "visible": l.visible}
              for l in psd.descendants() if l.kind == "smartobject"]
    if not candidates:
        return {"allSmartObjects": all_so, "error": "no visible smart-object layer"} if all_so else None
    layer = max(candidates, key=lambda l: l.width * l.height)
    info: dict = {
        "layerName": layer.name,
        "bbox": [layer.left, layer.top, layer.right, layer.bottom],
        "size": [layer.width, layer.height],
        "allSmartObjects": all_so,
    }
    so = getattr(layer, "smart_object", None)
    data = getattr(so, "data", None) if so is not None else None
    if data:
        ext = ".jpg" if data[:3] == b"\xff\xd8\xff" else ".png"
        path = out / "assets" / f"icon{ext}"
        path.write_bytes(data)
        info.update({"file": str(path), "bytes": len(data),
                     "source": "smart-object raw content",
                     "sha256": hashlib.sha256(data).hexdigest()[:16]})
        return info
    try:
        img = layer.topil()
        if img is not None:
            path = out / "assets" / "icon.png"
            img.save(path)
            info.update({"file": str(path), "source": "layer raster (smart-object raw unavailable)"})
            return info
    except Exception as e:  # noqa: BLE001
        info["error"] = repr(e)
    return None



def _json_default(o):
    """Coerce psd-tools scalar wrappers (Integer/Float/Bool) to plain values."""
    v = getattr(o, "value", None)
    if isinstance(v, (int, float, bool, str)) or v is None:
        return v
    return str(o)

def extract(psd_path: str, out_dir: str) -> dict:
    out = Path(out_dir)
    (out / "assets").mkdir(parents=True, exist_ok=True)
    psd = PSDImage.open(psd_path)

    background, notes = _extract_background(psd)
    icon = _extract_icon(psd, out)

    layers: list[dict] = []
    text_layers: list[dict] = []
    diagnostics: list[dict] = []
    for layer in psd.descendants():
        entry = {"kind": layer.kind, "name": layer.name,
                 "bbox": [layer.left, layer.top, layer.right, layer.bottom],
                 "visible": layer.visible}
        fx = _effect_diagnostics(layer)
        if fx:
            entry["effects"] = fx
            diagnostics.append({"layer": layer.name, "effects": fx})
        layers.append(entry)
        if layer.kind == "type" and layer.visible:
            tl = _extract_type_layer(layer)
            text_layers.append(tl)

    # template draft: first type layer = title, second = description
    draft: dict = {
        "_comment": "machine-drafted from PSD extraction; hand-tune before finalizing (baseline values are estimates pending calibration)",
        "canvas": {"width": psd.width, "height": psd.height},
        "measured": {
            "background": background.get("color"),
            "icon": {k: icon[k] for k in ("bbox", "size")} if icon else None,
            "title": text_layers[0] if len(text_layers) > 0 else None,
            "description": text_layers[1] if len(text_layers) > 1 else None,
        },
        "assumptions": [
            "title.baselineY estimated from bbox bottom minus descender; needs render calibration",
            "description.firstBaselineOffset estimated from ascent; needs render calibration",
            "leading read from paragraph properties when fixed (PSD uses 100px); AutoLeading 1.2 otherwise",
        ],
    }

    styles = {"psd": psd_path, "canvas": [psd.width, psd.height], "typeLayers": text_layers}
    (out / "styles.json").write_text(json.dumps(styles, ensure_ascii=False, indent=1, default=_json_default), encoding="utf-8")
    (out / "template.draft.json").write_text(json.dumps(draft, ensure_ascii=False, indent=1, default=_json_default), encoding="utf-8")

    report = {
        "tool": {"name": "erika-psd-toolkit", "version": __version__,
                 "python": platform.python_version(), "platform": platform.platform()},
        "command": f"erika-psd extract {psd_path} --out {out}",
        "psd": {"path": psd_path, "canvas": [psd.width, psd.height],
                "sha256": hashlib.sha256(Path(psd_path).read_bytes()).hexdigest()[:16]},
        "supportedLayerKinds": SUPPORTED_LAYER_KINDS,
        "layers": layers,
        "background": background,
        "notes": notes,
        "diagnostics": diagnostics,
        "unsupportedEffectsCount": len(diagnostics),
    }
    (out / "extraction-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1, default=_json_default), encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="erika-psd",
                                     description="Erika PSD banner template extractor")
    sub = parser.add_subparsers(dest="command", required=True)
    p_ext = sub.add_parser("extract", help="extract template data and assets from a PSD")
    p_ext.add_argument("psd", help="path to the .psd file")
    p_ext.add_argument("--out", required=True, help="output directory")
    p_ind = sub.add_parser("induce", help="induce percentage layout rules from reference PSDs")
    p_ind.add_argument("psd", nargs="+", help="reference .psd files (2 or more)")
    p_ind.add_argument("--out", help="write the ratio report as JSON")
    args = parser.parse_args(argv)

    if args.command == "induce":
        from .induce import main as induce_main
        return induce_main([*args.psd] + (["--out", args.out] if args.out else []))

    report = extract(args.psd, args.out)
    text_count = 0
    # report text layer count for the summary line
    styles = json.loads((Path(args.out) / "styles.json").read_text(encoding="utf-8"))
    text_count = len(styles["typeLayers"])
    print(f"extracted: canvas={report['psd']['canvas'][0]}x{report['psd']['canvas'][1]} "
          f"layers={len(report['layers'])} textLayers={text_count} "
          f"bg={report['background'].get('color')} "
          f"unsupportedEffects={report['unsupportedEffectsCount']} -> {args.out}")
    for n in report["notes"]:
        print(f"  note: {n}")
    return 0

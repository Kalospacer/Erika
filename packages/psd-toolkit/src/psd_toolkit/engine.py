"""Safe accessors for psd-tools engine-data structures.

psd-tools parses Photoshop TYSH engine data into nested ``Property``/``Dict``
objects backed by ``_items``. The generic mapping API is inconsistent across
versions, so all access goes through these helpers plus try/except at call
sites -- anything unreadable becomes a diagnostic, never a crash.
"""

from __future__ import annotations

from typing import Any


def _key_str(k: Any) -> str:
    """Normalize dict keys: engine-data keys are Property objects wrapping str."""
    if isinstance(k, str):
        return k
    v = getattr(k, "value", None)
    if isinstance(v, str):
        return v
    s = str(k)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        return s[1:-1]
    return s


def items_of(obj: Any) -> list[tuple[str, Any]]:
    """Return (key, value) pairs of a Property/Dict/dict-like object."""
    if hasattr(obj, "_items"):
        d = obj._items
        if isinstance(d, dict):
            return [(_key_str(k), v) for k, v in d.items()]
        if isinstance(d, (list, tuple)):
            return [(_key_str(k), v) for k, v in d]
        return []
    if isinstance(obj, dict):
        return [(_key_str(k), v) for k, v in obj.items()]
    return []


def get(obj: Any, key: str) -> Any:
    """Fetch a child by key from a Property/Dict-like object (None if absent)."""
    for k, v in items_of(obj):
        if k == key:
            return v
    return None


def to_plain(obj: Any, depth: int = 0) -> Any:
    """Recursively convert engine-data structures to plain python values."""
    if depth > 12:
        return "..."
    pairs = items_of(obj) if depth > 0 or not isinstance(obj, dict) else list(obj.items())
    if pairs and not isinstance(obj, (list, tuple)):
        return {k: to_plain(v, depth + 1) for k, v in pairs}
    if isinstance(obj, (list, tuple)):
        return [to_plain(v, depth + 1) for v in obj]
    if isinstance(obj, (int, float, bool, str)) or obj is None:
        return obj
    return str(obj)


def unwrap_str(v: Any) -> str | None:
    """Unwrap a Property-wrapped string ('Name' values etc.) to a plain str."""
    if isinstance(v, str):
        return v
    inner = getattr(v, "value", None)
    if isinstance(inner, str):
        return inner
    if v is None:
        return None
    s = str(v)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        return s[1:-1]
    return s


def _plain_list(v: Any) -> list | None:
    """Coerce a value (plain list or psd-tools List wrapper) to a plain list."""
    if isinstance(v, (list, tuple)):
        return list(v)
    if hasattr(v, "_items") and isinstance(v._items, (list, tuple)):
        return list(v._items)
    try:
        return list(v)
    except TypeError:
        return None


def fill_color_hex(fill: Any) -> str | None:
    """FillColor Property -> '#RRGGBB' (Values = [alpha, r, g, b] floats)."""
    values = _plain_list(get(fill, "Values"))
    if values is None and isinstance(fill, dict):
        values = _plain_list(fill.get("Values"))
    if not values or len(values) < 4:
        return None
    r, g, b = (round(float(getattr(v, "value", v)) * 255) for v in values[1:4])
    return f"#{r:02X}{g:02X}{b:02X}"

import io
p = "packages/core/src/types.ts"
s = io.open(p, encoding="utf-8").read()
old = """  /** baseline of first line = top + firstBaselineOffset.
   * Omit to auto-derive from the resolved font's cap height (font-independent). */
  firstBaselineOffset?: number;
  wrap?: "manual-first";
  overflow?: { mode: "ellipsis" };
}

export interface IconSlot {"""
new = """  /** baseline of first line = top + firstBaselineOffset.
   * Omit to auto-derive from the resolved font's cap height (font-independent). */
  firstBaselineOffset?: number;
  wrap?: "manual-first";
  overflow?: { mode: "ellipsis" };
  /** 垂直版式带底（canvas px）：描述自动缩排的可用带下限。 */
  bandBottom?: number;
  /** 描述自动缩排：文案超出 maxLines 时字号在 [1.0, minScale] 内下探。 */
  autoFit?: { mode: "scale-down"; minScale: number };
}

export interface IconSlot {"""
assert old in s, "DescriptionSlot tail anchor"
s = s.replace(old, new)
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("DescriptionSlot fields added")

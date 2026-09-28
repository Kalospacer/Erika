import { describe, expect, it } from "vitest";
import {
  buildTitleRuns,
  fitTitle,
  runsWidth,
  wrapDescription,
  type MeasureFn,
} from "../src/layout.js";
import type { DescriptionSlot, TitleSlot } from "../src/types.js";

/** Deterministic fake: monospace 0.6em glyphs, tracking appended per char. */
const fakeMeasure: MeasureFn = (text, size, tracking) =>
  [...text].length * (0.6 + tracking) * size;

describe("buildTitleRuns", () => {
  it("splits Muika-After-Story like the PSD style runs (1,5,1,5,1,5)", () => {
    const runs = buildTitleRuns("Muika-After-Story");
    expect(runs.map((r) => [r.color, r.text])).toEqual([
      ["accent", "M"],
      ["base", "uika-"],
      ["accent", "A"],
      ["base", "fter-"],
      ["accent", "S"],
      ["base", "tory"],
    ]);
  });

  it("groups consecutive CJK chars into one accented word", () => {
    const runs = buildTitleRuns("你好世界");
    expect(runs.map((r) => [r.color, r.text])).toEqual([
      ["accent", "你"],
      ["base", "好世界"],
    ]);
  });

  it("accents the first letter after separators inside the text", () => {
    const runs = buildTitleRuns("foo_bar baz");
    expect(runs.map((r) => [r.color, r.text])).toEqual([
      ["accent", "f"],
      ["base", "oo_"],
      ["accent", "b"],
      ["base", "ar "],
      ["accent", "b"],
      ["base", "az"],
    ]);
  });
});

describe("fitTitle", () => {
  // fake measure: 0.7em per char (0.6 glyph + 0.1 tracking)
  const base: TitleSlot = {
    x: 0,
    baselineY: 0,
    maxWidth: 100,
    font: "Test",
    size: 100,
    tracking: 0.1,
    overflow: "ellipsis",
  };

  it("scales down proportionally to fit (above minScale floor)", () => {
    // 3 chars -> 210 wide; maxWidth 105 -> target size 50, floor 10
    const slot = { ...base, autoFit: { mode: "scale-down" as const, minScale: 0.1 }, maxWidth: 105 };
    const { size, ellipsized } = fitTitle("abc", slot, fakeMeasure);
    expect(ellipsized).toBe(false);
    expect(size).toBeCloseTo(50, 5);
  });

  it("floors at minScale and ellipsizes beyond it", () => {
    const slot = { ...base, autoFit: { mode: "scale-down" as const, minScale: 0.7 } };
    const long = "a".repeat(50);
    const fit = fitTitle(long, slot, fakeMeasure);
    expect(fit.size).toBeCloseTo(70, 5);
    expect(fit.ellipsized).toBe(true);
    const width = runsWidth(fit.runs, fit.size, slot.tracking, fakeMeasure);
    expect(width).toBeLessThanOrEqual(slot.maxWidth);
  });

  it("leaves fitting text untouched", () => {
    const slot = { ...base, autoFit: { mode: "scale-down" as const, minScale: 0.7 }, maxWidth: 150 };
    const { size, ellipsized } = fitTitle("ab", slot, fakeMeasure);
    expect(size).toBe(100);
    expect(ellipsized).toBe(false);
  });
});

describe("wrapDescription", () => {
  const slot: DescriptionSlot = {
    x: 0,
    top: 0,
    maxWidth: 6 * 58.33 * 1.1, // 10 chars per line with tracking
    maxLines: 4,
    font: "Test",
    size: 58.33,
    tracking: 0.1,
    leading: 1.2,
    wrap: "manual-first",
    overflow: { mode: "ellipsis" },
  };

  it("keeps manual line breaks", () => {
    const { lines, ellipsized } = wrapDescription("aaa\nbbb\nccc", slot, fakeMeasure);
    expect(lines).toEqual(["aaa", "bbb", "ccc"]);
    expect(ellipsized).toBe(false);
  });

  it("trims trailing empty lines from PSD \\r runs", () => {
    const { lines } = wrapDescription("aaa\rbbb\r\r", slot, fakeMeasure);
    expect(lines).toEqual(["aaa", "bbb"]);
  });

  it("wraps an overlong manual line on spaces", () => {
    const { lines } = wrapDescription("aaaaa bbbbb ccccc", slot, fakeMeasure);
    // 10 chars/line -> "aaaaa bb.." style greedy split, at least 2 lines, no loss
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.join(" ").replace(/…/g, "")).toContain("aaaaa");
  });

  it("clamps to maxLines with ellipsis", () => {
    const { lines, ellipsized } = wrapDescription("1\n2\n3\n4\n5\n6", slot, fakeMeasure);
    expect(lines.length).toBe(4);
    expect(ellipsized).toBe(true);
    expect(lines[3].endsWith("…")).toBe(true);
  });
});

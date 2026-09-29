import { describe, expect, it } from "vitest";
import {
  accentSegments,
  buildTitleRuns,
  fitTitle,
  parseAccentMarkers,
  runsWidth,
  wrapDescription,
  type MeasureFn,
} from "../src/layout.js";
import type { DescriptionSlot, TitleSlot } from "../src/types.js";

/** Deterministic fake: monospace 0.6em glyphs, tracking appended per char. */
const fakeMeasure: MeasureFn = (text, size, tracking) =>
  [...text].length * (0.6 + tracking) * size;

describe("buildTitleRuns", () => {
  it("splits hyphenated names into word-initial accent runs", () => {
    const runs = buildTitleRuns("Erika-Banner-Service");
    expect(runs.map((r) => [r.color, r.text])).toEqual([
      ["accent", "E"],
      ["base", "rika-"],
      ["accent", "B"],
      ["base", "anner-"],
      ["accent", "S"],
      ["base", "ervice"],
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

  it("reports where each wrapped line starts in the input text", () => {
    const text = "aaa\nbbb ccc ddd eee fff";
    const { lines, lineStarts } = wrapDescription(text, slot, fakeMeasure);
    expect(lines[0]).toBe("aaa");
    expect(lineStarts[0]).toBe(0);
    // every line's start must point at a matching slice of the input
    lineStarts.forEach((start, i) => {
      expect(text.slice(start, start + lines[i].length), lines[i]).toBe(lines[i]);
    });
    // later lines start after earlier ones (monotonic)
    for (let i = 1; i < lineStarts.length; i++) {
      expect(lineStarts[i]).toBeGreaterThan(lineStarts[i - 1]);
    }
  });
});

describe("parseAccentMarkers", () => {
  it("strips paired markers and reports spans over the marker-free text", () => {
    const parsed = parseAccentMarkers("A **Nonebot 2** plugin");
    expect(parsed.text).toBe("A Nonebot 2 plugin");
    expect(parsed.spans).toEqual([{ start: 2, end: 11 }]);
    expect(parsed.text.slice(parsed.spans[0].start, parsed.spans[0].end)).toBe("Nonebot 2");
  });

  it("supports several spans and leaves unpaired markers literal", () => {
    expect(parseAccentMarkers("**A** and **B**")).toEqual({
      text: "A and B",
      spans: [{ start: 0, end: 1 }, { start: 6, end: 7 }],
    });
    expect(parseAccentMarkers("2 ** 3 = 8")).toEqual({ text: "2 ** 3 = 8", spans: [] });
    expect(parseAccentMarkers("**unclosed")).toEqual({ text: "**unclosed", spans: [] });
    expect(parseAccentMarkers("****")).toEqual({ text: "****", spans: [] });
  });
});

describe("accentSegments", () => {
  it("maps a span onto the line that contains it", () => {
    const spans = [{ start: 2, end: 11 }];
    expect(accentSegments("A Nonebot 2 plugin", 0, spans)).toEqual([
      { text: "A ", accent: false },
      { text: "Nonebot 2", accent: true },
      { text: " plugin", accent: false },
    ]);
    // second line of the same text: the span does not reach it
    expect(accentSegments("plugin here", 14, spans)).toEqual([{ text: "plugin here", accent: false }]);
  });

  it("clips a span that crosses a line boundary", () => {
    const spans = [{ start: 0, end: 9 }];
    expect(accentSegments("abcd", 4, spans)).toEqual([{ text: "abcd", accent: true }]);
    expect(accentSegments("efgh", 8, spans)).toEqual([
      { text: "e", accent: true },
      { text: "fgh", accent: false },
    ]);
  });
});

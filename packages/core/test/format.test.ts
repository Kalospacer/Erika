import { describe, expect, it } from "vitest";
import { formatNumber } from "../src/format.js";

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [9, "9"],
    [999, "999"],
    [1000, "1k"],
    [1234, "1.2k"],
    [4200, "4.2k"],
    [10000, "10k"],
    [12345, "12.3k"],
    [999999, "1000k"],
    [1_000_000, "1M"],
    [1_234_567, "1.2M"],
  ])("formats %d as %s", (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });
});

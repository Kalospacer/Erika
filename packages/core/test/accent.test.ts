import { describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { detectAccentColor, colorContrast } from "../src/accent.js";
import { loadTemplate, renderBanner, DEFAULT_TEMPLATES_DIR } from "../src/index.js";
import { join } from "node:path";

async function illustration(backdrop?: string, color = "#8B65B5") {
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext("2d");
  if (backdrop) { ctx.fillStyle = backdrop; ctx.fillRect(0, 0, 64, 64); }
  ctx.fillStyle = "#EEEEEE"; ctx.fillRect(0, 8, 32, 48);
  ctx.fillStyle = "#111111"; ctx.fillRect(0, 8, 32, 10);
  ctx.fillStyle = color; ctx.fillRect(8, 20, 16, 16);
  return loadImage(await canvas.encode("png"));
}

describe("artwork accent", () => {
  it.each(["#F5F1EC", "#24201F"])("finds purple accessories and makes them readable on %s", async (bg) => {
    const color = detectAccentColor(await illustration(), bg, null)!;
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    expect(rgb[2]).toBeGreaterThan(rgb[0]);
    expect(rgb[0]).toBeGreaterThan(rgb[1]);
    expect(colorContrast(color, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("ignores a large colored backdrop", async () => {
    expect(detectAccentColor(await illustration("#FF0000"), "#24201F", "#FF0000"))
      .toBe(detectAccentColor(await illustration(), "#24201F", null));
  });

  it("falls back for grayscale, transparent, or unsupported backgrounds", async () => {
    expect(detectAccentColor(await illustration(undefined, "#888888"), "#FFFFFF", null)).toBeNull();
    expect(detectAccentColor(await loadImage(await createCanvas(64, 64).encode("png")), "#FFFFFF", null)).toBeNull();
    expect(detectAccentColor(await illustration(), "white", null)).toBeNull();
  });

  it("ignores isolated colored noise", async () => {
    const canvas = createCanvas(64, 64), ctx = canvas.getContext("2d");
    ctx.fillStyle = "#888888"; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#FF0000"; ctx.fillRect(0, 0, 1, 1);
    expect(detectAccentColor(await loadImage(await canvas.encode("png")), "#FFFFFF", null)).toBeNull();
  });

  it("preserves preset defaults, overrides them explicitly, and falls back without artwork", async () => {
    const template = loadTemplate("grokbot");
    const base = { template, data: { fullName: "A/B", name: "Banner" },
      fontDirs: [join(DEFAULT_TEMPLATES_DIR, "fonts")],
      preset: { themeOverrides: { light: { accent: "#123456" } } } };
    for (const [accent, expected] of [[undefined, "#123456"], ["auto", "#123456"], ["#ffffff", "#FFFFFF"]]) {
      const result = await renderBanner({ ...base, params: { theme: "light", scale: 0.1, accent } });
      expect(result.accent).toBe(expected);
    }
    await expect(renderBanner({ ...base, params: { accent: "red" } })).rejects.toThrow();
  });
});

/** Description accent runs (`**…**`): the markers must never reach measurement
 * (identical layout with and without them) while the span paints in the theme's
 * accent colour. */

import { describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TEMPLATES_DIR, loadTemplate } from "../src/templates.js";
import { renderBanner } from "../src/index.js";

const FONT_DIRS = [join(DEFAULT_TEMPLATES_DIR, "fonts")];
const BG: [number, number, number] = [36, 32, 31]; // grokbot dark #24201F
const ACCENT: [number, number, number] = [0xab, 0x6b, 0x55]; // dark theme accent
const TEXT: [number, number, number] = [0x99, 0x99, 0x99]; // dark theme description

const near = (p: [number, number, number], q: [number, number, number], tol = 16) =>
  Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol && Math.abs(p[2] - q[2]) < tol;

async function render(description: string): Promise<Buffer> {
  return (
    await renderBanner({
      template: loadTemplate("grokbot", DEFAULT_TEMPLATES_DIR),
      data: { fullName: "Moemu/Muika-After-Story", name: "Muika-After-Story", description: null, private: false },
      iconOverride: { kind: "builtin", buffer: readFileSync(join(DEFAULT_TEMPLATES_DIR, "assets", "grokbot-default.webp")) },
      fontDirs: FONT_DIRS,
      format: "png",
      params: { scale: 0.5, bgCapture: false, description },
    })
  ).buffer;
}

/** Scan the description column (canvas 1465..2863 x / 990..1420 y at scale .5)
 * for the ink bbox and the accent/text pixel counts. */
async function scan(buffer: Buffer) {
  const img = await loadImage(buffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img as unknown as Parameters<typeof ctx.drawImage>[0], 0, 0);
  const x0 = 733;
  const x1 = Math.min(img.width - 1, 1432);
  const y0 = 495;
  const y1 = Math.min(img.height - 1, 710);
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, accent = 0, text = 0;
  for (let i = 0; i < data.length; i += 4) {
    const px = i / 4;
    const x = x0 + (px % (x1 - x0));
    const y = y0 + Math.floor(px / (x1 - x0));
    const c: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
    const ink = !near(c, BG, 18);
    if (ink) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (near(c, ACCENT)) accent++;
    if (near(c, TEXT)) text++;
  }
  return { bbox: [minX, minY, maxX, maxY], accent, text };
}

const PLAIN = "A Nonebot 2 plugin for Maimai";
const MARKED = "A **Nonebot 2** plugin for Maimai";

describe("description accent runs", () => {
  it("markers cost no width: the drawn block is identical", async () => {
    const [plain, marked] = await Promise.all([scan(await render(PLAIN)), scan(await render(MARKED))]);
    expect(marked.bbox).toEqual(plain.bbox);
    expect(marked.text).toBeGreaterThan(0);
    expect(marked.accent).toBeGreaterThan(0);
  });

  it("without markers nothing is painted in the accent colour", async () => {
    const plain = await scan(await render(PLAIN));
    expect(plain.accent).toBe(0);
    expect(plain.text).toBeGreaterThan(0);
  });

  it("unpaired markers stay literal text", async () => {
    const unpaired = await scan(await render("2 ** 3 = 8"));
    expect(unpaired.accent).toBe(0);
    expect(unpaired.text).toBeGreaterThan(0);
  });
});

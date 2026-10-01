import { describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TEMPLATES_DIR, loadTemplate, renderBanner } from "../src/index.js";
import type { RenderParams, Template } from "../src/types.js";

const template = loadTemplate("grokbot");
const fontDirs = [join(DEFAULT_TEMPLATES_DIR, "fonts")];

async function artwork(background?: string): Promise<Buffer> {
  const canvas = createCanvas(500, 500);
  const ctx = canvas.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 500, 500);
  }
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(100, 100, 300, 300);
  return canvas.encode("png");
}

async function render(buffer: Buffer, params: RenderParams, tpl: Template = template) {
  return (await renderBanner({
    template: tpl, data: { fullName: "A/Project", name: "Project", description: "A **fixed** description.", stargazersCount: 42 },
    iconOverride: { kind: "repo", buffer }, fontDirs, format: "png", params: { scale: 0.3, ...params },
  })).buffer;
}

async function pixels(buffer: Buffer) {
  const img = await loadImage(buffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

function pixel(data: Awaited<ReturnType<typeof pixels>>, x: number, y: number): number[] {
  const offset = (Math.round(y) * data.width + Math.round(x)) * 4;
  return Array.from(data.data.slice(offset, offset + 3));
}

describe("theme artwork", () => {
  it("keeps opaque artwork size and position across explicit themes", async () => {
    const img = await artwork("#24201f");
    const redPixels = async (theme: string) => {
      const data = await pixels(await render(img, { theme }));
      const positions: number[] = [];
      for (let i = 0; i < data.data.length; i += 4) {
        if (data.data[i] === 255 && data.data[i + 1] === 0 && data.data[i + 2] === 0) positions.push(i);
      }
      return positions;
    };
    expect(await redPixels("light")).toEqual(await redPixels("dark"));
  });

  it("composites transparent artwork directly on each selected background", async () => {
    const img = await artwork();
    for (const [theme, background] of [["light", [245, 241, 236]], ["dark", [36, 32, 31]]] as const) {
      const data = await pixels(await render(img, { theme }));
      expect(pixel(data, 5, 5)).toEqual([...background]);
      expect(pixel(data, 65, 110)).toEqual([...background]);
      expect(pixel(data, 240, 270)).toEqual([255, 0, 0]);
    }
  });

  it("frames incompatible backgrounds and honors explicit square and circle masks", async () => {
    const img = await artwork("#24201f");
    const framed = await pixels(await render(img, { theme: "light" }));
    const square = await pixels(await render(img, { theme: "light", iconRound: false }));
    const circle = await pixels(await render(img, { theme: "light", iconRound: true }));
    // Template frame inset: (76.692, 102.47), with a ~13.4px corner radius.
    expect(pixel(framed, 78, 104)).toEqual([245, 241, 236]);
    expect(pixel(square, 78, 104)).toEqual([36, 32, 31]);
    expect(pixel(circle, 90, 170)).toEqual([245, 241, 236]);
    expect(pixel(framed, 240, 270)).toEqual([255, 0, 0]);
    expect(pixel(framed, 5, 5)).toEqual([245, 241, 236]);
  });

  it("anchors text to the same band when theme variants have different materials", async () => {
    const c = createCanvas(500, 500);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#24201f";
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(474, 0, 26, 26); // complex corner -> contained image
    const opaque = await pixels(await render(await c.encode("png"), { theme: "dark" }));
    const transparent = await pixels(await render(await artwork(), { theme: "dark" }));
    for (let y = 0; y < opaque.height; y++) {
      const start = (y * opaque.width + 440) * 4;
      const end = (y + 1) * opaque.width * 4;
      expect(opaque.data.slice(start, end)).toEqual(transparent.data.slice(start, end));
    }
  });

  it("ships a transparent builtin with opaque face and eyes", async () => {
    const data = await pixels(readFileSync(join(DEFAULT_TEMPLATES_DIR, "assets", "erika-transparent.png")));
    const alpha = (x: number, y: number) => data.data[(y * data.width + x) * 4 + 3];
    expect(alpha(data.width - 5, 5)).toBe(0);
    for (const [x, y] of [[0.3, 0.54], [0.59, 0.71], [0.5, 0.5]]) {
      expect(alpha(Math.round(data.width * x), Math.round(data.height * y))).toBeGreaterThanOrEqual(250);
    }
    let transparent = 0;
    for (let i = 3; i < data.data.length; i += 4) if (data.data[i] === 0) transparent++;
    expect(transparent / (data.width * data.height)).toBeGreaterThan(0.05);
  });
});

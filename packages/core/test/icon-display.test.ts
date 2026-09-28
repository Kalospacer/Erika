/** Icon display acceptance matrix (review 2026-09-27):
 * - the layout guarantees the gap to the text column for a fully-filling image
 * - display modes (contain/cover/round/position) are independent of the source
 * - contain never crops; transparent regions composite onto the template bg */

import { describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { join } from "node:path";
import { DEFAULT_TEMPLATES_DIR, loadTemplate } from "../src/templates.js";
import { renderBanner, captureBackgroundColor } from "../src/index.js";
import type { Template } from "../src/types.js";

const FONT_DIRS = [join(DEFAULT_TEMPLATES_DIR, "fonts")];
const BG: [number, number, number] = [36, 32, 31]; // grokbot dark #24201F

function classic(): Template {
  return loadTemplate("grokbot", DEFAULT_TEMPLATES_DIR);
}

function withIconPosition(position: { x: number; y: number }): Template {
  const tpl = classic();
  return { ...tpl, slots: { ...tpl.slots, icon: { ...tpl.slots.icon, position } } };
}

function solidImage(w: number, h: number, color: string): Promise<Buffer> {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c.encode("png");
}

function transparentCenterImage(w: number, h: number, inner: number, color: string): Promise<Buffer> {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect((w - inner) / 2, (h - inner) / 2, inner, inner);
  return c.encode("png");
}

function uniformBorderImage(size: number, border: string, inner: string, innerSize: number): Promise<Buffer> {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = inner;
  ctx.fillRect((size - innerSize) / 2, (size - innerSize) / 2, innerSize, innerSize);
  return c.encode("png");
}

async function renderIcon(img: Buffer, overrides: Partial<Parameters<typeof renderBanner>[0]> = {}) {
  return renderBanner({
    template: classic(),
    data: { fullName: "A/a", name: "a", description: null, private: false },
    iconOverride: { buffer: img, kind: "avatar" },
    fontDirs: FONT_DIRS,
    format: "png",
    ...overrides,
    params: { scale: 1, bgCapture: false, ...overrides.params },
  });
}

async function pixel(webp: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const img = await loadImage(webp);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img as unknown as Parameters<typeof ctx.drawImage>[0], 0, 0);
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}

const near = (p: [number, number, number], q: [number, number, number], tol = 14) =>
  Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol && Math.abs(p[2] - q[2]) < tol;

// with bgCapture=false the contained archetype draws the icon inside the
// template area (264, 402) size 996 -> right edge 1260; the text column
// starts at x=1500: pixels in [1261, 1499] must stay background.

describe("icon display acceptance matrix", () => {
  it("full-bleed square, contained fallback: fills the area, layout gap guaranteed", async () => {
    const webp = (await renderIcon(await solidImage(500, 500, "#ff0000"))).buffer;
    for (const [x, y] of [[762, 900], [270, 410], [1350, 450], [1450, 450], [900, 500], [500, 1200]]) {
      console.log("dbg", x, y, await pixel(webp, x, y));
    }
    expect(near(await pixel(webp, 762, 900), [255, 0, 0])).toBe(true); // area center
  });

  it("horizontal logo, contain: whole logo visible, letterbox shows background", async () => {
    const webp = (await renderIcon(await solidImage(900, 200, "#ff0000"))).buffer;
    expect(near(await pixel(webp, 870, 890), [255, 0, 0])).toBe(true); // inside logo
    expect(near(await pixel(webp, 550, 600), BG)).toBe(true); // letterbox above
    expect(near(await pixel(webp, 1350, 450), BG)).toBe(true); // gap still holds
  });

  it("vertical artwork, contain: no crop, sides show background", async () => {
    const webp = (await renderIcon(await solidImage(200, 900, "#ff0000"))).buffer;
    expect(near(await pixel(webp, 762, 900), [255, 0, 0])).toBe(true);
    expect(near(await pixel(webp, 550, 900), BG)).toBe(true); // letterbox left
    expect(near(await pixel(webp, 1350, 450), BG)).toBe(true);
  });

  it("transparent logo: capture reports transparency, contained layout composes bg", async () => {
    const img = await transparentCenterImage(500, 500, 250, "#ff0000");
    expect(captureBackgroundColor(await loadImage(img)).transparent).toBe(true);
    const webp = (await renderIcon(img)).buffer; // no bgCapture override -> contained
    expect(near(await pixel(webp, 762, 900), [255, 0, 0])).toBe(true); // opaque center
    expect(near(await pixel(webp, 500, 560), BG)).toBe(true); // transparent corner -> bg
  });

  it("cover with focal position crops the configured side", async () => {
    const c = createCanvas(1000, 500);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(500, 0, 500, 500);
    const img = await c.encode("png");

    const left = await renderBanner({
      template: withIconPosition({ x: 0, y: 0.5 }),
      data: { fullName: "A/a", name: "a", description: null, private: false },
      iconOverride: { buffer: img, kind: "avatar" },
      fontDirs: FONT_DIRS,
      format: "png",
      params: { iconFit: "cover" },
    });
    const right = await renderBanner({
      template: withIconPosition({ x: 1, y: 0.5 }),
      data: { fullName: "A/a", name: "a", description: null, private: false },
      iconOverride: { buffer: img, kind: "avatar" },
      fontDirs: FONT_DIRS,
      format: "png",
      params: { iconFit: "cover" },
    });
    expect(near(await pixel(left.buffer, 600, 450), [0, 255, 0])).toBe(true); // left focal -> green
    expect(near(await pixel(right.buffer, 600, 450), [0, 0, 255])).toBe(true); // right focal -> blue
  });

  it("round mask is explicit, not source-driven", async () => {
    const img = await solidImage(500, 500, "#ff0000");
    const square = await renderIcon(img); // slot default: radius 0
    expect(near(await pixel(square.buffer, 485, 515), [255, 0, 0])).toBe(true); // area corner still red
    const round = await renderIcon(img, { params: { iconRound: true } });
    expect(near(await pixel(round.buffer, 270, 410), BG)).toBe(true); // corner clipped away
    expect(near(await pixel(round.buffer, 762, 450), [255, 0, 0])).toBe(true); // center red
  });

  it("background capture: uniform Grokbot backdrop is adopted as the banner background", async () => {
    const img = await solidImage(500, 500, "#ff0000");
    const webp = (
      await renderIcon(img, { iconOverride: { buffer: img, kind: "repo" }, params: { bgCapture: true } })
    ).buffer;
    expect(near(await pixel(webp, 1450, 450), [255, 0, 0])).toBe(true); // banner bg = captured red
    expect(near(await pixel(webp, 760, 450), [255, 0, 0])).toBe(true); // artwork blends over its own bg
  });

  it("background capture: an avatar never repaints the canvas (card path)", async () => {
    const img = await solidImage(500, 500, "#ff0000");
    const webp = (await renderIcon(img, { params: { bgCapture: true } })).buffer; // kind: "avatar"
    expect(near(await pixel(webp, 1450, 450), BG)).toBe(true); // theme background kept
    expect(near(await pixel(webp, 762, 900), [255, 0, 0])).toBe(true); // icon inside its card box
    expect(near(await pixel(webp, 1300, 450), BG)).toBe(true); // gap region stays background
  });

  it("background capture: non-uniform top-right region returns null (card fallback)", async () => {
    const c = createCanvas(500, 500);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = "#000000";
    ctx.fillRect(474, 0, 26, 26); // content crossing the sampled top-right corner
    expect(captureBackgroundColor(await loadImage(await c.encode("png"))).color).toBeNull();
  });

  it("background capture: the shipped Grokbot sources sample cleanly (regression)", async () => {
    // their left edge carries the artwork, so the old border-wide sampler always
    // failed on these exact files; the top-right region is blank by design
    for (const name of ["muika-icon.webp", "rikka-icon.webp", "grokbot-default.webp"]) {
      const cap = captureBackgroundColor(await loadImage(join(DEFAULT_TEMPLATES_DIR, "assets", name)));
      expect(cap.transparent).toBe(false);
      expect(cap.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("explicit theme fixes background and palette (no capture)", async () => {
    const webp = (
      await renderIcon(await solidImage(500, 500, "#ff0000"), {
        params: { theme: "dark", iconFit: "cover" },
      })
    ).buffer;
    // explicit theme -> no capture: cover draws the avatar over the whole
    // slot (264..1476); its own red background covers everything inside.
    // explicit theme disables capture -> the contained archetype always
    // applies (guaranteed gap), with the query fit honored: red fills
    // (264..1260, 402..1398), everything outside is the theme background.
    expect(near(await pixel(webp, 760, 450), [255, 0, 0])).toBe(true);
    expect(near(await pixel(webp, 500, 450), [255, 0, 0])).toBe(true);
    expect(near(await pixel(webp, 1440, 450), BG)).toBe(true);
    expect(near(await pixel(webp, 1490, 450), BG)).toBe(true);
    expect(near(await pixel(webp, 1400, 900), BG)).toBe(true);
  });

  it("source neutrality: same image via preset path and avatar buffer -> identical bytes", async () => {
    const img = await solidImage(500, 500, "#ff0000");
    const viaPreset = await renderIcon(img, { iconOverride: { buffer: img, kind: "repo" } });
    const viaAvatar = await renderIcon(img, { iconOverride: { buffer: img, kind: "avatar" } });
    expect(Buffer.compare(viaPreset.buffer, viaAvatar.buffer)).toBe(0);
  });

  it("ratio layout: grokbot-kind icons blend in the blend box, avatars keep the card box", async () => {
    // uniform red border + green centre: capture succeeds (blend eligible) and
    // the inner square's position reveals WHICH template box was drawn.
    const img = await uniformBorderImage(500, "#ff0000", "#00ff00", 100);
    expect(captureBackgroundColor(await loadImage(img)).color).toBe("#ff0000");
    const tpl = classic();
    const blend = tpl.slots.iconBlend!;
    const card = tpl.slots.icon;
    const base = {
      template: tpl,
      data: { fullName: "A/a", name: "a", description: null, private: false },
      fontDirs: FONT_DIRS,
      format: "png" as const,
      params: { scale: 1 },
    };
    // the two boxes place the green centre differently; probe the non-overlapping
    // parts of the two green squares (blend-only right part, card-only left part)
    const blendOnlyX = blend.x + blend.size * 0.555;
    const cardOnlyX = card.x + card.size * 0.434;
    const midY = card.y + card.size / 2;
    const blended = await renderBanner({ ...base, iconOverride: { buffer: img, kind: "repo" } });
    expect(near(await pixel(blended.buffer, blendOnlyX, midY), [0, 255, 0])).toBe(true);
    expect(near(await pixel(blended.buffer, cardOnlyX, midY), [255, 0, 0])).toBe(true);
    // avatar fallback: the card box is used, so the green square moves there and
    // the blend box region stays backdrop -- the text gap therefore holds
    const asAvatar = await renderBanner({ ...base, iconOverride: { buffer: img, kind: "avatar" } });
    expect(near(await pixel(asAvatar.buffer, cardOnlyX, midY), [0, 255, 0])).toBe(true);
    expect(near(await pixel(asAvatar.buffer, blendOnlyX, midY), [255, 0, 0])).toBe(true);
  }, 20000);

  it("ratio layout: templates carry percentages, resolution keeps the design rules", () => {
    const tpl = classic();
    const W = tpl.canvas.width;
    const H = tpl.canvas.height;
    const blend = tpl.slots.iconBlend!;
    const card = tpl.slots.icon;
    expect(tpl.layout?.iconBlend?.size).toBeCloseTo(0.4053, 4); // induced from the PSDs
    expect(blend.size / W).toBeCloseTo(0.4053, 3);
    expect((blend.y + blend.size / 2) / H).toBeCloseTo(0.4989, 3);
    expect(tpl.slots.title.x / W).toBeCloseTo(0.4882, 3);
    expect(tpl.slots.title.inkTop! / H).toBeCloseTo(0.3828, 3);
    expect(tpl.slots.description.top / H).toBeCloseTo(0.5616, 3);
    // the card's right edge keeps the designed 240px gap to the text column
    expect(tpl.slots.title.x - (card.x + card.size)).toBe(241);
    // the text column still fits the widest reference PSD line (1363px)
    expect(tpl.slots.description.maxWidth).toBeGreaterThan(1363);
    // metadata must survive the README downscale: a 3000px canvas lands in a
    // ~830px column (27.7%), so >=50 canvas px keeps it >=14px on screen
    expect(tpl.slots.meta?.size).toBeGreaterThanOrEqual(50);
    // and it must not hug the description: the title->description ink gap is
    // 0.114H, so the footer keeps at least half of that vertical rhythm
    expect(tpl.slots.meta?.footer?.gap ?? 0).toBeGreaterThanOrEqual(0.05);
  });
});

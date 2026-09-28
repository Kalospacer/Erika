/** Font selection report (M1 acceptance): metrics table + cropped comparison
 * sheet against the Photoshop reference banner. Baselines auto-derive per font
 * from the template's inkTop anchors, so rows are directly comparable.
 *
 * Usage: node packages/core/scripts/compare-fonts.mjs [extra-fonts-dir]
 */

import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBanner } from "../dist/render.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const templatesDir = join(repoRoot, "packages", "templates");
const fontDirs = [join(templatesDir, "fonts")];
if (process.argv[2]) fontDirs.push(process.argv[2]);

const FONT_EXTS = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const registered = [];
for (const dir of fontDirs) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    if (!FONT_EXTS.has(extname(entry).toLowerCase())) continue;
    const alias = basename(entry, extname(entry));
    if (GlobalFonts.registerFromPath(join(dir, entry), alias)) registered.push(alias);
  }
}

const norm = (s) => s.toLowerCase().replace(/[\s_-]/g, "");
const stripWeight = (s) => norm(s).replace(/(semibold|medium|regular|bold)$/u, "");
function resolveFamily(requested) {
  const n = norm(requested);
  let hit = registered.find((a) => norm(a) === n);
  if (hit) return hit;
  const nw = stripWeight(requested);
  hit = registered.find((a) => stripWeight(a) === nw);
  if (hit) return hit;
  return registered.find((a) => nw.length >= 3 && stripWeight(a).startsWith(nw)) ?? null;
}

const probe = createCanvas(10, 10).getContext("2d");
const mWidth = (text, size, trackingEm, family) => {
  probe.font = `${size}px "${family}"`;
  if ("letterSpacing" in probe) probe.letterSpacing = `${trackingEm * size}px`;
  return probe.measureText(text).width;
};
const inkAscent = (sample, size, family) => {
  probe.font = `${size}px "${family}"`;
  return probe.measureText(sample).actualBoundingBoxAscent ?? 0;
};

const TITLE = "Muika-After-Story";
const TARGET_TITLE_WIDTH = 1274; // PSD ink width (Torus, effective 125px + 0.1em)

const template = JSON.parse(readFileSync(join(templatesDir, "classic.json"), "utf-8"));
const titleSize = template.slots.title.size;
const descSize = template.slots.description.size;
const titleTracking = template.slots.title.tracking;
const data = JSON.parse(readFileSync(join(templatesDir, "extracted", "mas", "data.json"), "utf-8"));
const preset = JSON.parse(readFileSync(join(templatesDir, "presets", "mas.json"), "utf-8"));

const candidates = ["Torus SemiBold", "Baloo 2", "Quicksand", "Comfortaa"];
const rows = [];
console.log(`registered: ${registered.filter((a) => /torus|baloo|quick|comfort/i.test(a)).join(", ")}`);
console.log(`\nfamily               titleWidth(@${titleSize}px)  vsTorus  inkAscent(Mk)  inkAscent(Akd)`);
for (const name of candidates) {
  const family = resolveFamily(name);
  if (!family) {
    console.log(`${name.padEnd(20)}  NOT REGISTERED`);
    continue;
  }
  const w = mWidth(TITLE, titleSize, titleTracking, family);
  const aMk = inkAscent("Mk", titleSize, family);
  const aAkd = inkAscent("Akd", descSize, family);
  const delta = (((w - TARGET_TITLE_WIDTH) / TARGET_TITLE_WIDTH) * 100).toFixed(1);
  console.log(
    `${family.padEnd(20)}  ${w.toFixed(0).padStart(8)}  ${(delta + "%").padStart(7)}  ${aMk.toFixed(0).padStart(10)}  ${aAkd.toFixed(0).padStart(10)}`,
  );
  rows.push({ name, family, w });
}

mkdirSync(join(repoRoot, "out", "fontcmp"), { recursive: true });
const rowFiles = [];
for (const row of rows) {
  const out = join(repoRoot, "out", "fontcmp", `${row.family.replace(/[\s_]/g, "")}.png`);
  const res = await renderBanner({ template, data, preset, fontDirs, fontOverride: row.family, format: "png" });
  writeFileSync(out, res.buffer);
  rowFiles.push({ ...row, file: out });
  console.log(`rendered ${out} font=${res.fontUsed}`);
}

// compose sheet: reference row (Photoshop export) + per-font crops of the text area
const REF = String.raw`D:\Muika-After-Story\assets\banner.png`;
const CROP = { x: 620, y: 240, w: 880, h: 620 }; // text area of a 1500x900 render
const sheetW = 280 + CROP.w;
const rowH = CROP.h;
const sheet = createCanvas(sheetW, rowH * (rowFiles.length + 1));
const sctx = sheet.getContext("2d");
sctx.fillStyle = "#111";
sctx.fillRect(0, 0, sheet.width, sheet.height);
sctx.font = '32px "Baloo2-SemiBold"';
sctx.fillStyle = "#fff";
sctx.fillText("Photoshop (Torus)", 12, 60);
const refImg = await loadImage(REF);
sctx.drawImage(refImg, CROP.x / 0.5, CROP.y / 0.5, CROP.w / 0.5, CROP.h / 0.5, 280, 0, CROP.w, rowH);

for (let i = 0; i < rowFiles.length; i++) {
  const row = rowFiles[i];
  const y = rowH * (i + 1);
  const img = await loadImage(row.file);
  sctx.fillStyle = "#fff";
  sctx.font = '28px "Baloo2-SemiBold"';
  sctx.fillText(row.family, 12, y + 56);
  sctx.font = '22px "Baloo2-SemiBold"';
  sctx.fillStyle = "#aaa";
  sctx.fillText(`width ${row.w.toFixed(0)}`, 12, y + 88);
  sctx.fillText(`${((row.w / TARGET_TITLE_WIDTH) * 100).toFixed(0)}% of Torus`, 12, y + 114);
  sctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 280, y, CROP.w, rowH);
}

const sheetOut = join(repoRoot, "out", "font-comparison.png");
writeFileSync(sheetOut, await sheet.encode("png"));
console.log(`\nsheet: ${sheetOut}`);

/** Compose the M1 acceptance sheet: PSD reference + rendered outputs. */
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fontDirs = [join(repoRoot, "packages", "templates", "fonts")];
const labelFont = (() => { try { GlobalFonts.registerFromPath("C:\Windows\Fonts\msyh.ttc", "MSYaHei"); return "MSYaHei"; } catch { return "Quicksand-SemiBold"; } })();
for (const d of fontDirs)
  for (const e of readdirSync(d))
    if (/\.(ttf|otf)$/i.test(e)) GlobalFonts.registerFromPath(join(d, e), basename(e, extname(e)));

const rows = [
  { label: "Photoshop (Torus) — 参考基线", file: String.raw`D:\Muika-After-Story\assets\banner.png` },
  { label: "Erika + Quicksand（公开默认）— mas", file: join(repoRoot, "out", "mas.webp") },
  { label: "Erika + Quicksand — rikka（另一项目复用）", file: join(repoRoot, "out", "rikka.webp") },
  { label: "Erika + Quicksand — classic-stats（星标行）", file: join(repoRoot, "out", "mas-stats.webp") },
];
const RW = 1400;
const RH = 840;
const sheet = createCanvas(RW, RH * rows.length);
const ctx = sheet.getContext("2d");
ctx.fillStyle = "#151312";
ctx.fillRect(0, 0, sheet.width, sheet.height);
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const img = await loadImage(r.file);
  const s = Math.min(RW / img.width, (RH - 44) / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.fillStyle = "#fff";
  ctx.font = '26px "MSYaHei"';
  ctx.fillText(r.label, 14, i * RH + 30);
  ctx.drawImage(img, (RW - dw) / 2, i * RH + 44, dw, dh);
}
const out = join(repoRoot, "out", "m1-acceptance.png");
writeFileSync(out, await sheet.encode("png"));
console.log("sheet:", out);

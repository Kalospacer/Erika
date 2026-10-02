import { createCanvas, type loadImage } from "@napi-rs/canvas";

type RGB = [number, number, number];
const hex = (rgb: RGB): string => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const rgbOf = (color: string): RGB => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as RGB;

function luminance(rgb: RGB): number {
  const linear = rgb.map((v) => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function colorContrast(a: string, b: string): number {
  const x = luminance(rgbOf(a)), y = luminance(rgbOf(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Find the nearest readable tint or shade; manual colors never take this path. */
function readableColor(rgb: RGB, background: string): string {
  const original = hex(rgb);
  if (colorContrast(original, background) >= 4.5) return original;
  const target = colorContrast("#000000", background) > colorContrast("#FFFFFF", background) ? 0 : 255;
  for (let step = 1; step <= 100; step++) {
    const color = hex(rgb.map((v) => v + (target - v) * step / 100) as RGB);
    if (colorContrast(color, background) >= 4.5) return color;
  }
  return hex([target, target, target]);
}

/** Bound sampling cost, ignore backdrop/neutral pixels, and aggregate by hue.
 * Saturation weighting lets colorful accessories compete with large pale areas. */
export function detectAccentColor(
  image: Awaited<ReturnType<typeof loadImage>>,
  background: string,
  artworkBackground: string | null,
): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(background)) return null;
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, 64, 64);
  const pixels = ctx.getImageData(0, 0, 64, 64).data;
  const backdrop = artworkBackground ? rgbOf(artworkBackground) : null;
  const bins = Array.from({ length: 24 }, () => ({ weight: 0, count: 0, rgb: [0, 0, 0] as RGB }));
  let foreground = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue;
    const rgb: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (backdrop && rgb.every((v, c) => Math.abs(v - backdrop[c]) < 32)) continue;
    foreground++;
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const lightness = (max + min) / 2;
    if (delta === 0 || lightness < 0.12 || lightness > 0.88) continue;
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (saturation < 0.18) continue;
    const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
    const bin = bins[Math.round(hue / 15) % bins.length];
    const weight = saturation ** 2;
    bin.weight += weight;
    bin.count++;
    rgb.forEach((v, c) => { bin.rgb[c] += v * weight; });
  }
  const candidate = bins.filter((bin) => bin.count >= Math.max(4, foreground * 0.005))
    .sort((a, b) => b.weight - a.weight)[0];
  return candidate ? readableColor(candidate.rgb.map((v) => v / candidate.weight) as RGB, background) : null;
}

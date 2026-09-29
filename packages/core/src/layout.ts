/** Pure layout engine: measure function is injected, so everything is testable
 * without a canvas. Colors are decided here ("accent"/"base"), painting happens
 * in render.ts. */

import type { DescriptionSlot, TitleSlot } from "./types.js";

export interface TextRun {
  text: string;
  color: "accent" | "base";
}

/** (text, fontSize, trackingEm) -> rendered width in canvas units */
export type MeasureFn = (text: string, size: number, tracking: number) => number;

const DEFAULT_TOKENIZE = "[-_\u2013\u2014\\s]|[\\u4e00-\\u9fff]";
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/u;
const TRAILING_SEPS_RE = /[\s\u2013\u2014_-]+$/u;

function isSeparator(ch: string, re: RegExp): boolean {
  return re.test(ch);
}

function mergeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    const prev = out[out.length - 1];
    if (prev && prev.color === run.color) prev.text += run.text;
    else out.push({ ...run });
  }
  return out;
}

/** Word-initial accent runs: first char of each word uses the accent color.
 * Separators (- _ – — whitespace) end the current word and stay base-colored,
 * matching the PSD style runs (e.g. M|uika-|A|fter-|S|tory). Consecutive CJK
 * chars form one word so only the first char is accented. */
export function buildTitleRuns(text: string, tokenizeSource?: string): TextRun[] {
  const re = new RegExp(tokenizeSource ?? DEFAULT_TOKENIZE, "u");
  const runs: TextRun[] = [];
  let baseBuf = "";
  let expectingAccent = true;
  let inCjkWord = false;

  const flushBase = () => {
    if (baseBuf) {
      runs.push({ text: baseBuf, color: "base" });
      baseBuf = "";
    }
  };

  for (const ch of text) {
    if (CJK_RE.test(ch)) {
      // CJK chars are word boundaries, not separators: consecutive CJK chars
      // form one word, its first char accented.
      if (inCjkWord) {
        baseBuf += ch;
      } else {
        flushBase();
        runs.push({ text: ch, color: "accent" });
        inCjkWord = true;
        expectingAccent = false;
      }
    } else if (isSeparator(ch, re)) {
      flushBase();
      runs.push({ text: ch, color: "base" });
      expectingAccent = true;
      inCjkWord = false;
    } else {
      if (expectingAccent) {
        flushBase();
        runs.push({ text: ch, color: "accent" });
        expectingAccent = false;
      } else {
        baseBuf += ch;
      }
      inCjkWord = false;
    }
  }
  flushBase();
  return mergeRuns(runs);
}

export function runsWidth(
  runs: TextRun[],
  size: number,
  tracking: number,
  measure: MeasureFn,
): number {
  return runs.reduce((acc, r) => acc + measure(r.text, size, tracking), 0);
}

export interface FitTitleResult {
  runs: TextRun[];
  size: number;
  ellipsized: boolean;
}

/** Scale the title down to fit maxWidth (floor minScale), then ellipsize. */
export function fitTitle(
  text: string,
  slot: TitleSlot,
  measure: MeasureFn,
): FitTitleResult {
  const tokenize = slot.tokenize;
  const widthAt = (t: string, size: number) =>
    runsWidth(buildTitleRuns(t, tokenize), size, slot.tracking, measure);

  let size = slot.size;
  if (slot.autoFit?.mode === "scale-down" && widthAt(text, size) > slot.maxWidth) {
    const target = (size * slot.maxWidth) / widthAt(text, size);
    size = Math.max(slot.autoFit.minScale * slot.size, target);
  }

  let current = text;
  let ellipsized = false;
  if (slot.overflow === "ellipsis" && widthAt(current, size) > slot.maxWidth) {
    while (current.length > 1 && widthAt(current + "\u2026", size) > slot.maxWidth) {
      current = current.slice(0, -1).replace(TRAILING_SEPS_RE, "");
      ellipsized = true;
    }
    if (ellipsized) current = current.replace(TRAILING_SEPS_RE, "") + "\u2026";
  }

  return { runs: buildTitleRuns(current, tokenize), size, ellipsized };
}

export interface WrapResult {
  lines: string[];
  ellipsized: boolean;
}

export interface DescFitResult {
  /** 建议字号（绝对 px） */
  size: number;
  /** 相对 slot.size 的缩放 */
  scale: number;
  /** true = 缩到 minScale 仍放不下全部文案（渲染时将省略） */
  ellipsized: boolean;
}

/** 描述容量估算（供 /v1/meta 宣传真实上限）：垂直版式带驱动行数，
 * 行数 × 平均字宽容量的最大值（按 minScale）。 */
export function estimateDescriptionCapacity(
  slot: DescriptionSlot,
  measure: MeasureFn,
): number {
  const minScale = slot.autoFit?.mode === "scale-down" ? (slot.autoFit.minScale ?? 0.6) : 1;
  const bandHeight =
    slot.bandBottom != null ? Math.max(0, slot.bandBottom - slot.top) : Infinity;
  const avgW =
    measure("An event-loop Chatbot framework", slot.size, slot.tracking) /
    "An event-loop Chatbot framework".length;
  const lineHeight = slot.size * slot.leading;
  const lines = Math.max(1, Math.floor(bandHeight / lineHeight));
  const charsPerLine = Math.max(1, Math.floor(slot.maxWidth / avgW));
  return lines * charsPerLine;
}

/** 描述自动缩排搜索：从 1.0 起按步长下探，返回能容纳 text 的最大字号
 * （供渲染端以真实 wrap 验证后采用）。 */
export function descriptionFitSearch(
  slot: DescriptionSlot,
  minScale: number,
): Array<number> {
  const scales: number[] = [];
  for (let s = 1; s >= minScale - 1e-9; s = Math.round((s - 0.04) * 100) / 100) {
    scales.push(s);
  }
  return scales;
}

/** manual-first: keep explicit line breaks, wrap overlong lines greedily on
 * spaces (char-level binary search as bound), clamp to maxLines with ellipsis. */
export function wrapDescription(
  text: string,
  slot: DescriptionSlot,
  measure: MeasureFn,
): WrapResult {
  const m = (s: string) => measure(s, slot.size, slot.tracking);
  const manual = text.split(/\r\n|\r|\n/u).map((l) => l.replace(/\s+$/u, ""));
  while (manual.length > 0 && manual[manual.length - 1] === "") manual.pop();

  const lines: string[] = [];
  let ellipsized = false;

  for (const line of manual) {
    if (lines.length >= slot.maxLines) {
      ellipsized = true;
      break;
    }
    if (line === "" || m(line) <= slot.maxWidth) {
      lines.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > 0) {
      if (lines.length >= slot.maxLines) {
        ellipsized = true;
        break;
      }
      if (m(rest) <= slot.maxWidth) {
        lines.push(rest);
        rest = "";
        break;
      }
      let lo = 1;
      let hi = rest.length;
      let fit = 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (m(rest.slice(0, mid)) <= slot.maxWidth) {
          fit = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      let cut = rest.slice(0, fit);
      const sp = cut.lastIndexOf(" ");
      if (sp > 0 && sp >= fit * 0.5) cut = rest.slice(0, sp);
      lines.push(cut.replace(/\s+$/u, ""));
      rest = rest.slice(cut.length).replace(/^\s+/u, "");
    }
  }

  if (ellipsized && slot.overflow?.mode === "ellipsis" && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && m(last + "\u2026") > slot.maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last.replace(/\s+$/u, "") + "\u2026";
  }

  return { lines, ellipsized };
}


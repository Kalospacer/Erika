import type { MetaField } from "@erika/shared";
import { formatNumber } from "./format.js";
import type { MeasureFn } from "./layout.js";
import type { BannerData, MetaSlot } from "./types.js";

export interface MetaSegment {
  text: string;
  glyph?: "star" | "fork" | "issue" | "tag" | "license" | "code" | "clock";
}

export function declaredMetaFields(slot: MetaSlot | null): MetaField[] {
  if (!slot) return [];
  return [...new Set([...(slot.topline?.fields ?? []), ...(slot.footer?.fields ?? [])])];
}

export function defaultMetaFields(slot: MetaSlot | null): MetaField[] {
  const declared = declaredMetaFields(slot);
  return slot?.defaultFields?.filter((field) => declared.includes(field)) ?? declared;
}

export function metadataSegments(fields: MetaField[], data: BannerData): MetaSegment[] {
  const segments: MetaSegment[] = [];
  for (const field of fields) {
    if (field === "stars" && data.stargazersCount != null) {
      segments.push({ text: formatNumber(data.stargazersCount), glyph: "star" });
    } else if (field === "forks" && data.forksCount != null) {
      segments.push({ text: formatNumber(data.forksCount), glyph: "fork" });
    } else if (field === "issues" && data.openIssuesCount != null) {
      segments.push({ text: formatNumber(data.openIssuesCount), glyph: "issue" });
    } else if (field === "release" && data.releaseTag) {
      segments.push({ text: data.releaseTag, glyph: "tag" });
    } else if (field === "full_name" && data.fullName) {
      segments.push({ text: data.fullName });
    } else if (field === "license" && data.licenseSpdxId && data.licenseSpdxId !== "NOASSERTION") {
      segments.push({ text: data.licenseSpdxId, glyph: "license" });
    } else if (field === "language" && data.language) {
      segments.push({ text: data.language, glyph: "code" });
    } else if (field === "last_updated" && data.pushedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(data.pushedAt)) {
      const timestamp = Date.parse(data.pushedAt);
      if (Number.isFinite(timestamp)) {
        segments.push({ text: new Date(timestamp).toISOString().slice(0, 10), glyph: "clock" });
      }
    }
  }
  return segments;
}

/** Keep a row inside its text column. Shrink first, then shorten each value. */
export function fitMetadataRow(
  segments: MetaSegment[], slot: MetaSlot, maxWidth: number, measure: MeasureFn,
): { segments: MetaSegment[]; size: number } {
  const textWidth = (text: string, size: number) => measure(text, size, slot.tracking);
  const overhead = (items: MetaSegment[], size: number) =>
    items.filter((item) => item.glyph).length * size * 1.02 +
    Math.max(0, items.length - 1) * (textWidth(slot.separator, size) + size * slot.separatorGap * 2);
  const width = overhead(segments, slot.size) + segments.reduce((sum, item) => sum + textWidth(item.text, slot.size), 0);
  if (width <= maxWidth) return { segments, size: slot.size };
  const size = slot.size * Math.max(0.75, maxWidth / width);
  const items = segments.map((item) => ({ ...item }));
  const ellipsisWidth = textWidth("…", size);
  while (items.length && overhead(items, size) + items.length * ellipsisWidth > maxWidth) items.pop();
  const budget = maxWidth - overhead(items, size);
  const widths = items.map((item) => textWidth(item.text, size));
  const total = widths.reduce((sum, value) => sum + value, 0);
  if (total <= budget + 0.000001) return { segments: items, size };
  const sortedWidths = [...widths].sort((a, b) => a - b);
  let remaining = budget;
  let limit = ellipsisWidth;
  for (let index = 0; index < sortedWidths.length; index++) {
    limit = remaining / (sortedWidths.length - index);
    if (sortedWidths[index] > limit) break;
    remaining -= sortedWidths[index];
  }
  items.forEach((item, index) => {
    if (widths[index] <= limit) return;
    const chars = Array.from(item.text);
    let low = 0;
    let high = chars.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (textWidth(chars.slice(0, mid).join("") + "…", size) <= limit) low = mid;
      else high = mid - 1;
    }
    item.text = chars.slice(0, low).join("") + "…";
  });
  return { segments: items, size };
}

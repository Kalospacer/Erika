import { describe, expect, it } from "vitest";
import { defaultMetaFields, declaredMetaFields, fitMetadataRow, metadataSegments } from "../src/metadata.js";
import { loadTemplate, renderBanner, DEFAULT_TEMPLATES_DIR } from "../src/index.js";
import { join } from "node:path";

const template = loadTemplate("grokbot");
const slot = template.slots.meta!;
const data = { name: "Project", description: "A fixed description.", licenseSpdxId: "MIT", language: "TypeScript", pushedAt: "2026-10-01T01:30:00+08:00" };
const measure = (text: string, size: number, tracking: number) => [...text].length * (0.6 + tracking) * size;

describe("metadata", () => {
  it("formats the SPDX identifier, language and UTC code push date", () => {
    expect(metadataSegments(["license", "language", "last_updated"], data)).toEqual([
      { text: "MIT", glyph: "license" }, { text: "TypeScript", glyph: "code" }, { text: "2026-09-30", glyph: "clock" },
    ]);
  });

  it("skips absent, unrecognized and invalid values", () => {
    expect(metadataSegments(["license", "language", "last_updated"], { name: "Empty", description: null, licenseSpdxId: "NOASSERTION", language: null, pushedAt: "invalid" })).toEqual([]);
    expect(metadataSegments(["last_updated"], { ...data, pushedAt: "2026-10-01T00:00:00" })).toEqual([]);
  });

  it("offers new fields without changing existing template defaults", () => {
    expect(declaredMetaFields(slot)).toContain("last_updated");
    expect(defaultMetaFields(slot)).toEqual(["full_name", "stars", "forks", "issues", "release"]);
    expect(defaultMetaFields({ ...slot, defaultFields: undefined })).toEqual(declaredMetaFields(slot));
    expect(defaultMetaFields(null)).toEqual([]);
  });

  it("preserves a fitting row and bounds a long row with every selected field", () => {
    const short = metadataSegments(["license"], data);
    expect(fitMetadataRow(short, slot, 1000, measure)).toEqual({ segments: short, size: slot.size });
    const shrunk = fitMetadataRow(short, slot, 130, measure);
    expect(shrunk.segments).toEqual(short);
    expect(shrunk.size).toBeLessThan(slot.size);
    const long = metadataSegments(["license", "language", "last_updated"], { ...data, language: "语言😀".repeat(120) });
    const result = fitMetadataRow(long, slot, 900, measure);
    expect(result.size).toBe(slot.size * 0.75);
    expect(result.segments).toHaveLength(3);
    expect(result.segments[1].text).toContain("…");
    expect(result.segments[0].text).toBe("MIT");
    expect(result.segments[2].text).toBe("2026-09-30");
    expect(result.segments[1].text).not.toMatch(/[\uD800-\uDBFF]…/u);
    const width = result.segments.reduce((sum, item) => sum + measure(item.text, result.size, slot.tracking) + (item.glyph ? result.size * 1.02 : 0), 0) +
      (result.segments.length - 1) * (measure(slot.separator, result.size, slot.tracking) + result.size * slot.separatorGap * 2);
    expect(width).toBeLessThanOrEqual(900 + 0.001);
    expect(fitMetadataRow(long, slot, 1, measure).segments).toEqual([]);
  });

  it("renders new fields only when selected and skips an empty footer", async () => {
    const render = async (meta?: string[], overrides = {}) => (await renderBanner({
      template, data: { ...data, ...overrides }, params: { meta, scale: 0.2, theme: "light" },
      fontDirs: [join(DEFAULT_TEMPLATES_DIR, "fonts")], format: "png",
    })).buffer;
    expect(await render()).toEqual(await render(undefined, { licenseSpdxId: null, language: null, pushedAt: null }));
    expect(await render(["license", "language", "last_updated"])).not.toEqual(await render([]));
    expect(await render(["license", "language", "last_updated"], { licenseSpdxId: null, language: null, pushedAt: null })).toEqual(await render([]));
  });
});

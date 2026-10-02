import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadTemplate, loadPresetRegistry, renderBanner, DEFAULT_PRESETS_PATH, DEFAULT_TEMPLATES_DIR } from "@erika/core";

const require = createRequire(new URL("../packages/core/package.json", import.meta.url));
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const root = fileURLToPath(new URL("..", import.meta.url));
const baselines = join(root, "tests/visual/baselines");
const output = join(root, "out/visual");
const update = process.argv.includes("--update");
const registry = loadPresetRegistry(DEFAULT_PRESETS_PATH);
const avatar = createCanvas(240, 320);
const ctx = avatar.getContext("2d");
ctx.fillStyle = "#698DB5";
ctx.fillRect(0, 0, 240, 320);
ctx.fillStyle = "#F1B998";
ctx.fillRect(45, 60, 150, 180);
/** Erika itself is the default subject; the stranger case proves the reuse
 * path with no preset and no hand-tuned copy. */
const erika = {
  fullName: "Moemu/Erika",
  name: "Erika",
  description: "A URL-driven banner service: point an image at a repository and get a portrait banner back.",
  defaultBranch: "main",
  private: false,
};
const stranger = {
  fullName: "Some/Random-Repository",
  name: "Random-Repository",
  description: "A repository this service has never seen before.",
  defaultBranch: "main",
  private: false,
};
const cases = [
  { id: "erika-repo", template: "grokbot", repo: "Moemu/Erika", data: erika, asset: "erika.webp", kind: "repo", params: {} },
  {
    id: "erika-accent",
    template: "grokbot",
    repo: "Moemu/Erika",
    data: { ...erika, description: "A **URL-driven** banner service for GitHub repositories." },
    asset: "erika.webp",
    kind: "repo",
    params: {},
  },
  { id: "stranger-repo", template: "grokbot", repo: "Some/Random-Repository", data: stranger, asset: "erika.webp", kind: "repo", params: {} },
  ...["light", "dark"].flatMap((theme) => [
    { id: `erika-transparent-${theme}`, template: "grokbot", repo: "Moemu/Erika", data: erika, asset: "erika-transparent.png", kind: "repo", params: { theme } },
    { id: `erika-opaque-${theme}`, template: "grokbot", repo: "Moemu/Erika", data: erika, asset: "erika.webp", kind: "repo", params: { theme } },
  ]),
  ...["light", "dark"].map((theme) => ({
    id: `metadata-${theme}`, template: "grokbot", repo: "Moemu/Erika",
    data: { ...erika, licenseSpdxId: "MIT", language: "TypeScript", pushedAt: "2026-10-01T00:00:00Z" },
    asset: "erika-transparent.png", kind: "repo", params: { theme, meta: ["full_name", "license", "language", "last_updated"] },
  })),
  ...["light", "dark"].flatMap((theme) => ["en", "zh"].map((lang) => ({
    id: `not-found-${lang}-${theme}`, template: "grokbot",
    data: {
      fullName: "Example/Missing", name: "Example/Missing", private: false,
      description: lang === "zh" ? "仓库不存在，或已转为私有。" : "Repository not found, or set to private.",
    },
    asset: "erika-not-found.png", kind: "builtin", params: { theme, meta: [] },
  }))),
  {
    id: "metadata-long", template: "avatar",
    data: { ...stranger, licenseSpdxId: "GPL-3.0-or-later", language: "A very long language name with 中文字符", pushedAt: "2026-10-01T00:00:00Z" },
    kind: "avatar", params: { theme: "light", meta: ["full_name", "stars", "forks", "issues", "release", "license", "language", "last_updated"] },
  },
  { id: "avatar-zh-light", template: "avatar", data: { fullName: "Example/Project", name: "中文项目与长标题排版", description: "这是固定的中文描述，用来检查字体回退、换行和图文间距。\nA fixed bilingual description for visual regression." }, kind: "avatar", params: { theme: "light" } },
];
mkdirSync(update ? baselines : output, { recursive: true });
let failed = false;
for (const item of cases) {
  const result = await renderBanner({
    template: loadTemplate(item.template),
    preset: item.repo ? registry.get(item.repo) : null,
    data: { ...item.data, stargazersCount: 42, forksCount: 3, openIssuesCount: 2, releaseTag: "v1.0.0" },
    iconOverride: {
      kind: item.kind,
      buffer: item.asset ? readFileSync(join(DEFAULT_TEMPLATES_DIR, "assets", item.asset)) : await avatar.encode("png"),
    },
    params: { ...item.params, scale: 0.5 },
    fontDirs: [join(DEFAULT_TEMPLATES_DIR, "fonts")],
    fontOverride: "Quicksand",
    format: "png",
  });
  const baselinePath = join(baselines, `${item.id}.png`);
  if (update) {
    writeFileSync(baselinePath, result.buffer);
    console.log(`Updated ${item.id}; inspect before committing.`);
    continue;
  }
  const [expected, actual] = await Promise.all([loadImage(baselinePath), loadImage(result.buffer)]);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    writeFileSync(join(output, `${item.id}.actual.png`), result.buffer);
    console.error(`${item.id}: image dimensions changed`);
    failed = true;
    continue;
  }
  const pixels = (img) => {
    const canvas = createCanvas(img.width, img.height);
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0);
    return context.getImageData(0, 0, img.width, img.height);
  };
  const a = pixels(expected).data;
  const diff = pixels(actual);
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    // Small channel differences tolerate cross-platform antialiasing; geometry
    // and substantial color changes still mark pixels across the whole image.
    if ([0, 1, 2, 3].some((c) => Math.abs(a[i + c] - diff.data[i + c]) > 20)) {
      changed++;
      diff.data.set([255, 0, 100, 255], i);
    }
  }
  const ratio = changed / (expected.width * expected.height);
  console.log(`${item.id}: ${(ratio * 100).toFixed(4)}% changed (limit 0.2%)`);
  if (ratio > 0.002) {
    failed = true;
    writeFileSync(join(output, `${item.id}.actual.png`), result.buffer);
    const canvas = createCanvas(actual.width, actual.height);
    canvas.getContext("2d").putImageData(diff, 0, 0);
    writeFileSync(join(output, `${item.id}.diff.png`), await canvas.encode("png"));
  }
}
if (failed) process.exitCode = 1;

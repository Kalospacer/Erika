import { describe, expect, it } from "vitest";
import { REPO_ICON_PATHS, isRepoRelativePath, presetIconPaths, repoIconUrlsFor } from "../src/icons.js";

describe("theme icon candidates", () => {
  const preset = { icon: { path: "assets/original.webp", pathLight: "assets/light.webp", pathTransparent: "assets/transparent.png" } };

  it("uses light, transparent and original assets in order, without changing auto", () => {
    expect(presetIconPaths(preset, "light")).toEqual(["assets/light.webp", "assets/transparent.png", "assets/original.webp"]);
    expect(presetIconPaths(preset, "dark")).toEqual(["assets/transparent.png", "assets/original.webp"]);
    expect(presetIconPaths(preset)).toEqual(["assets/original.webp"]);
  });

  it("keeps ordered fallbacks and excludes filesystem paths from raw URLs", () => {
    expect(repoIconUrlsFor({ owner: "A", repo: "b", explicit: ["C:/private.png", ...presetIconPaths(preset, "light")] }))
      .toEqual(["light.webp", "transparent.png", "original.webp"].map((name) => `https://raw.githubusercontent.com/A/b/HEAD/assets/${name}`));
  });
});

describe("isRepoRelativePath", () => {
  it("accepts paths inside the repository", () => {
    for (const p of ["assets/grokbot-icon.webp", "icon.png", "docs/img/logo.webp", "a_b-c.1.webp"]) {
      expect(isRepoRelativePath(p), p).toBe(true);
    }
  });

  it("rejects absolute filesystem paths and parent traversal", () => {
    for (const p of [
      "/home/app/assets/icon.webp",
      "\\assets\\icon.webp",
      "C:\\Users\\me\\icon.webp",
      "D:/assets/icon.webp",
      "\\\\server\\share\\icon.webp",
      "assets/../../etc/passwd",
      "..",
      "   ",
    ]) {
      expect(isRepoRelativePath(p), p).toBe(false);
    }
  });
});

describe("repoIconUrlsFor", () => {
  const base = "https://raw.githubusercontent.com/Moemu/Erika/main";

  it("uses an explicit repo-relative path", () => {
    expect(repoIconUrlsFor({ owner: "Moemu", repo: "Erika", branch: "main", explicit: "assets/mine.webp" }))
      .toEqual([`${base}/assets/mine.webp`]);
  });

  it("falls back to the conventional paths when no explicit path is given", () => {
    expect(repoIconUrlsFor({ owner: "Moemu", repo: "Erika", branch: "main" }))
      .toEqual(REPO_ICON_PATHS.map((p) => `${base}/${p}`));
  });

  it("never concatenates a non-repo-relative path into the raw base", () => {
    for (const explicit of ["/home/app/icon.webp", "C:\\icons\\a.webp", "assets/../secret.webp"]) {
      const urls = repoIconUrlsFor({ owner: "Moemu", repo: "Erika", branch: "main", explicit });
      expect(urls, explicit).toEqual(REPO_ICON_PATHS.map((p) => `${base}/${p}`));
      expect(urls.some((u) => u.includes("home/app") || u.includes("C:") || u.includes("..")), explicit).toBe(false);
    }
  });
});

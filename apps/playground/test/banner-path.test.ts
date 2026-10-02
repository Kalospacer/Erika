import { describe, expect, it } from "vitest";
import { bannerPath, type ParamState } from "../src/lib/api.js";

const base: ParamState = {
  owner: "Moemu",
  repo: "Erika",
  template: null,
  theme: null,
  accent: null,
  title: "",
  description: "",
  scale: null,
  icon: null,
  iconPath: "",
  iconFit: null,
  iconRound: null,
  meta: null,
  lang: null,
  scheme: "dark",
  apiBase: "",
};

describe("bannerPath", () => {
  it("puts the extension at the end of the default-template path", () => {
    expect(bannerPath(base)).toBe("/v1/banner/Moemu/Erika.webp");
  });

  it("P1 regression: explicit template moves the extension to the whole path", () => {
    const p = bannerPath({ ...base, template: "avatar", theme: "dark" });
    expect(p).toBe("/v1/banner/Moemu/Erika/avatar.webp?theme=dark");
  });

  it("encodes owner/repo but keeps dotted repo names intact", () => {
    expect(bannerPath({ ...base, owner: "vercel", repo: "next.js" })).toBe(
      "/v1/banner/vercel/next.js.webp",
    );
  });

  it("carries meta explicit-off, icon overrides and scale", () => {
    const p = bannerPath({ ...base, template: "grokbot", meta: "", scale: 0.75, icon: "avatar", iconPath: "assets/mine.webp" });
    expect(p).toBe(
      "/v1/banner/Moemu/Erika/grokbot.webp?scale=0.75&icon=avatar&iconPath=assets%2Fmine.webp&meta=",
    );
  });

  it("exports automatic and custom accents with safe URL encoding", () => {
    expect(bannerPath({ ...base, accent: "auto" })).toBe("/v1/banner/Moemu/Erika.webp?accent=auto");
    expect(bannerPath({ ...base, accent: "#8B65B5" })).toBe("/v1/banner/Moemu/Erika.webp?accent=%238B65B5");
  });

  it("returns null for incomplete repo coordinates", () => {
    expect(bannerPath({ ...base, owner: "", repo: "x" })).toBeNull();
  });
});

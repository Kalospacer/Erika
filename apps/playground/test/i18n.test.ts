import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocale } from "../src/lib/locale.js";
import { translate } from "../src/lib/i18n.js";
import { readStateFromUrl, writeStateToUrl } from "../src/lib/url-state.js";
import { bannerPath, type ParamState } from "../src/lib/api.js";

afterEach(() => vi.unstubAllGlobals());

describe("interface language", () => {
  it("uses the shared language before the saved preference and browser language", () => {
    expect(resolveLocale("en", "zh-CN", ["zh-CN"])).toBe("en");
    expect(resolveLocale(null, "zh-CN", ["en-US"])).toBe("zh-CN");
  });

  it("ignores invalid preferences and finds a supported browser language", () => {
    expect(resolveLocale("invalid", "invalid", ["fr-FR", "zh-TW"])).toBe("zh-CN");
    expect(resolveLocale(null, null, ["en-GB", "zh-CN"])).toBe("en");
    expect(resolveLocale(null, null, ["fr-FR"])).toBe("en");
    expect(resolveLocale(null, null, [])).toBe("en");
  });

  it("formats runtime limits and uses localized prompt pages", () => {
    expect(translate("en", "titleHint", { limit: 25 })).toContain("25 characters");
    expect(translate("zh-CN", "descriptionHint", { limit: 180 })).toContain("180 字");
    expect(translate("en", "studioUrl")).toMatch(/\/en$/);
    expect(translate("zh-CN", "studioUrl")).toMatch(/\/zh-hans$/);
  });

  it("shares interface language separately from banner language and preserves configuration", () => {
    let writtenUrl = "";
    vi.stubGlobal("window", {
      location: { pathname: "/", search: "" },
      history: { replaceState: (_state: null, _title: string, url: string) => { writtenUrl = url; } },
    });
    const state: ParamState = {
      owner: "Moemu", repo: "Erika", template: "grokbot", theme: "light",
      title: "原始标题", description: "Original description", scale: 0.75,
      icon: "auto", iconPath: "assets/custom.png", iconFit: "contain", iconRound: "0",
      meta: "", lang: "zh", scheme: "light", apiBase: "https://example.com",
    };
    writeStateToUrl(state, "en");
    expect(new URL(writtenUrl, "https://example.com").searchParams.get("uiLang")).toBe("en");
    window.location.search = writtenUrl.slice(writtenUrl.indexOf("?"));
    expect(readStateFromUrl()).toEqual(state);
    expect(bannerPath(state)).toContain("lang=zh");
    expect(bannerPath(state)).not.toContain("uiLang");
    writeStateToUrl({ ...state, lang: null }, "zh-CN");
    const params = new URL(writtenUrl, "https://example.com").searchParams;
    expect(params.has("lang")).toBe(false);
    expect(params.get("uiLang")).toBe("zh-CN");
  });
});

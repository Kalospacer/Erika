import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveLocale, type Locale } from "./locale.js";

const zh = {
  period: "。", stars: "Star", forks: "Fork", issues: "Issue", release: "Release",
  pageTitle: "Erika Playground — 为你的仓库绘制肖像",
  interfaceLanguage: "界面语言",
  lightPreview: "亮色模拟", darkPreview: "暗色模拟",
  originalSize: "查看原始尺寸", readmeSize: "回到 README 比例", originalSizeHint: "原始尺寸 = scale 1",
  previewHint: "预览取自真实 API 响应；URL 即配置，可直接分享。",
  copyUrl: "复制图片 URL", reset: "重置", resetHint: "恢复演示配置",
  copy: "复制", copied: "已复制", copyFailed: "复制失败，请手动复制",
  metaFailed: "无法获取 /v1/meta", retry: "重试",
  template: "模板", theme: "主题", autoTemplate: "自动（按图标来源）", presetDefault: "跟随预设",
  dark: "暗色", light: "亮色", titleOverride: "标题覆盖", descriptionOverride: "描述覆盖",
  titleHint: "≤ {limit} 字，留空用仓库名", descriptionHint: "≤ {limit} 字，留空用仓库描述",
  scale: "输出缩放", iconSource: "图标来源", avatarHint: "头像会自动切换模板",
  autoIcon: "自动（项目图标优先）", defaultIcon: "默认图标", avatar: "GitHub 头像",
  guideTitle: "为项目制作 Grokbot 插画", studioLink: "打开 Grokbot Icon Studio 提示词页面 ↗",
  studioUrl: "https://grokbot-icon-studio.serio-ai.chatgpt.site/zh-hans",
  guideSummary: "生成后如何使用?",
  guideGenerate: "获取提示词，配合角色参考图，在 ChatGPT 等图片生成工具中制作插画。",
  guideSave: "将图片保存到目标仓库的默认分支，例如",
  guideTransparent: "亮暗主题共用时建议使用透明 PNG 或 WebP。",
  guideUse: "填写上方 Owner 和 Repo，图标来源选择“自动”。其他文件名可在“高级选项 → 项目图标路径”中指定。",
  guideCredit: "提示词来自", metadata: "元数据", fullName: "仓库全名", license: "许可证",
  language: "主要语言", lastUpdated: "代码更新日期", noMetadata: "该模板未声明元数据字段",
  advanced: "高级选项", iconPath: "项目图标路径", relativePath: "仓库内相对路径",
  iconDisplay: "图标展示", templateDefault: "跟随模板", contain: "完整展示", cover: "裁剪填满",
  roundCrop: "圆形裁剪", circle: "圆形", square: "方形", placeholderLanguage: "占位图语言",
  followInterface: "跟随界面", chinese: "中文", apiBase: "API 基址", sameOrigin: "留空 = 同源",
  htmlHint: "GitHub 会按亮暗主题选择图片。透明插画直接融合；不透明插画底色与主题不匹配时，使用圆角插画区。",
  bannerAlt: "仓库 Banner 预览", fallbackAlt: "仓库 Banner", loading: "正在加载…",
  enterRepo: "输入 Owner / Repo 生成预览", readmeWidth: "README 内容宽 ≈ 830px", output: "输出",
  icon: "图标", preset: "预设", applied: "已应用", noPreset: "未使用（可在 presets.json 添加）",
  placeholder: "占位图", loadFailed: "加载失败", repoIcon: "项目仓库图标", builtinIcon: "内置默认图标", none: "无",
  notFound: "仓库不存在或已私有", rateLimited: "GitHub 配额受限", timeout: "上游暂时不可用",
};

const en: Record<keyof typeof zh, string> = {
  period: ".", stars: "Star", forks: "Fork", issues: "Issue", release: "Release",
  pageTitle: "Erika Playground — Paint portraits for your repositories",
  interfaceLanguage: "Interface language",
  lightPreview: "Light preview", darkPreview: "Dark preview",
  originalSize: "Original size", readmeSize: "README size", originalSizeHint: "Original size = scale 1",
  previewHint: "Preview uses the live API. Share the URL to share your settings.",
  copyUrl: "Copy image URL", reset: "Reset", resetHint: "Restore demo settings",
  copy: "Copy", copied: "Copied", copyFailed: "Copy failed. Please copy manually.",
  metaFailed: "Could not load /v1/meta", retry: "Retry",
  template: "Template", theme: "Theme", autoTemplate: "Auto (icon source)", presetDefault: "Preset default",
  dark: "Dark", light: "Light", titleOverride: "Title override", descriptionOverride: "Description override",
  titleHint: "≤ {limit} characters; blank uses repo name", descriptionHint: "≤ {limit} characters; blank uses repo description",
  scale: "Output scale", iconSource: "Icon source", avatarHint: "Avatar selects its template automatically",
  autoIcon: "Auto (project icon first)", defaultIcon: "Default icon", avatar: "GitHub avatar",
  guideTitle: "Create a Grokbot illustration", studioLink: "Open Grokbot Icon Studio prompts ↗",
  studioUrl: "https://grokbot-icon-studio.serio-ai.chatgpt.site/en",
  guideSummary: "How do I use the generated image?",
  guideGenerate: "Get a prompt and use a character reference image in ChatGPT or another image generator.",
  guideSave: "Save the image to your repository’s default branch, for example",
  guideTransparent: "Use transparent PNG or WebP for both light and dark themes.",
  guideUse: "Enter Owner and Repo above, then select Auto for the icon source. For other filenames, use Advanced options → Project icon path.",
  guideCredit: "Prompts by", metadata: "Metadata", fullName: "Repository name", license: "License",
  language: "Primary language", lastUpdated: "Code updated", noMetadata: "This template has no metadata fields",
  advanced: "Advanced options", iconPath: "Project icon path", relativePath: "Path within the repository",
  iconDisplay: "Icon display", templateDefault: "Template default", contain: "Show full image", cover: "Crop to fill",
  roundCrop: "Icon shape", circle: "Circle", square: "Square", placeholderLanguage: "Placeholder language",
  followInterface: "Follow interface", chinese: "中文", apiBase: "API base URL", sameOrigin: "Blank = same origin",
  htmlHint: "GitHub selects the image for its theme. Transparent images blend in; opaque images use rounded corners when backgrounds differ.",
  bannerAlt: "Repository banner preview", fallbackAlt: "Repository banner", loading: "Loading…",
  enterRepo: "Enter Owner / Repo to preview", readmeWidth: "README content width ≈ 830px", output: "Output",
  icon: "Icon", preset: "Preset", applied: "Applied", noPreset: "None (add one in presets.json)",
  placeholder: "Placeholder", loadFailed: "Load failed", repoIcon: "Project repository icon", builtinIcon: "Built-in icon", none: "None",
  notFound: "Repository missing or private", rateLimited: "GitHub rate limit reached", timeout: "Upstream temporarily unavailable",
};

export type MessageKey = keyof typeof zh;
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}): string {
  return (locale === "zh-CN" ? zh : en)[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]));
}

const STORAGE_KEY = "erika.playground.locale";
const I18nContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: Translate } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Browser storage may be disabled. */ }
    return resolveLocale(new URLSearchParams(window.location.search).get("uiLang"), saved, navigator.languages);
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "pageTitle");
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* URL still preserves the language. */ }
  }, [locale]);
  const t: Translate = (key, values) => translate(locale, key, values);
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n requires I18nProvider");
  return context;
}

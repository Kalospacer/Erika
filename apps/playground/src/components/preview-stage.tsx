/** Preview stage: GitHub README simulation (light/dark, ~830px content width).
 * The image is the REAL API response -- preview is production. */

import { useI18n, type Translate } from "../lib/i18n.js";
import { cn } from "./ui.js";
import { FileText } from "lucide-react";
import type { PreviewImage } from "../lib/api.js";

const GH_SCHEME = {
  light: { bg: "#ffffff", border: "#d1d9e0" },
  dark: { bg: "#0d1117", border: "#3d444d" },
} as const;

export function PreviewStage({
  image,
  loading,
  error,
  scheme,
  raw,
  scale,
  canvas,
}: {
  image: PreviewImage | null;
  loading: boolean;
  error: string | null;
  scheme: "light" | "dark";
  raw: boolean;
  scale: number;
  canvas: { width: number; height: number } | null;
}) {
  const { t } = useI18n();
  const gh = GH_SCHEME[scheme];
  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-2xl border transition-colors"
        style={{ background: gh.bg, borderColor: gh.border }}
      >
        {/* README 文件视图头 */}
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{ borderColor: gh.border, background: scheme === "dark" ? "#161b22" : "#f6f8fa" }}
        >
          <span className="flex gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span
            className="ml-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs"
            style={{ background: scheme === "dark" ? "#0d1117" : "#ffffff", color: scheme === "dark" ? "#e6edf3" : "#1f2328" }}
          >
            <FileText size={12} />
            README.md
          </span>
        </div>

        {/* README content column ≈ 830px */}
        <div className={cn("mx-auto py-10", raw ? "max-w-full px-2" : "max-w-[830px] px-6")}>
          {image ? (
            <img
              src={image.blobUrl}
              alt={t("bannerAlt")}
              className={cn(
                "h-auto w-full rounded-lg transition-opacity duration-300",
                loading ? "opacity-40" : "opacity-100",
              )}
              draggable={false}
            />
          ) : (
            <div
              className="flex h-40 items-center justify-center text-sm"
              style={{ color: scheme === "dark" ? "#e6edf3" : "#1f2328" }}
            >
              {loading ? t("loading") : t("enterRepo")}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-ink-300">
        <span>GitHub {t(scheme)} · {t("readmeWidth")}</span>
        {image && canvas && (
          <span>
            {t("output")} {Math.round(canvas.width * scale)}×{Math.round(canvas.height * scale)} ·{" "}
            {(image.sizeBytes / 1024).toFixed(0)} KB
          </span>
        )}
        {image && (
          <span>
            {t("icon")}: {iconKindLabel(image.iconKind ?? "none", t)}
            {image.template ? ` · ${t("template")}: ${image.template}` : ""} · {t("preset")}:{" "}
            {image.presetUsed
              ? t("applied")
              : t("noPreset")}
          </span>
        )}
        {image?.accent && (
          <span className="inline-flex items-center gap-1.5">
            {t("accent")}: <i className="h-3 w-3 rounded-sm border border-ink-500" style={{ background: image.accent }} />{image.accent}
          </span>
        )}
        {image?.bannerError && (
          <span className="rounded-full bg-brand-500/12 px-2 py-0.5 text-brand-600 ring-1 ring-brand-500/30">
            {t("placeholder")}: {bannerErrorLabel(image.bannerError, t)}
          </span>
        )}
        {error && <span className="text-red-600">{t("loadFailed")}: {error}</span>}
      </div>
    </div>
  );
}

function iconKindLabel(kind: string, t: Translate): string {
  switch (kind) {
    case "repo":
      return t("repoIcon");
    case "avatar":
      return t("avatar");
    case "builtin":
      return t("builtinIcon");
    case "none":
      return t("none");
    default:
      return kind;
  }
}

function bannerErrorLabel(kind: string, t: Translate): string {
  switch (kind) {
    case "not-found":
      return t("notFound");
    case "upstream-rate-limited":
      return t("rateLimited");
    case "upstream-timeout":
      return t("timeout");
    default:
      return kind;
  }
}

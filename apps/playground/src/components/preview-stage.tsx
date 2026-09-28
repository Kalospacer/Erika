/** Preview stage: GitHub README simulation (light/dark, ~830px content width).
 * The image is the REAL API response -- preview is production. */

import { cn } from "./ui.js";
import { FileText } from "lucide-react";
import type { PreviewImage } from "../lib/api.js";

const GH_SCHEME = {
  light: { bg: "#ffffff", border: "#d1d9e0", label: "GitHub 亮色" },
  dark: { bg: "#0d1117", border: "#3d444d", label: "GitHub 暗色" },
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
  const gh = GH_SCHEME[scheme];
  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-2xl border shadow-2xl shadow-black/50 transition-colors"
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
              alt="仓库 Banner 预览"
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
              {loading ? "正在加载…" : "输入 owner / repo 生成预览"}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-ink-300">
        <span>{gh.label} · README 内容宽 ≈ 830px</span>
        {image && canvas && (
          <span>
            输出 {Math.round(canvas.width * scale)}×{Math.round(canvas.height * scale)} ·{" "}
            {(image.sizeBytes / 1024).toFixed(0)} KB
          </span>
        )}
        {image && (
          <span>
            图标：{iconKindLabel(image.iconKind ?? "none")}
            {image.template ? ` · 模板：${image.template}` : ""} · 预设：
            {image.presetUsed
              ? "已应用"
              : "未使用（可在 presets.json 添加）"}
          </span>
        )}
        {image?.bannerError && (
          <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-brand-200 ring-1 ring-brand-500/40">
            占位图：{bannerErrorLabel(image.bannerError)}
          </span>
        )}
        {error && <span className="text-red-400">加载失败：{error}</span>}
      </div>
    </div>
  );
}

function iconKindLabel(kind: string): string {
  switch (kind) {
    case "repo":
      return "项目仓库图标";
    case "avatar":
      return "GitHub 头像";
    case "builtin":
      return "内置默认图标";
    case "none":
      return "无";
    default:
      return kind;
  }
}

function bannerErrorLabel(kind: string): string {
  switch (kind) {
    case "not-found":
      return "仓库不存在或已私有";
    case "upstream-rate-limited":
      return "GitHub 配额受限";
    case "upstream-timeout":
      return "上游暂时不可用";
    default:
      return kind;
  }
}

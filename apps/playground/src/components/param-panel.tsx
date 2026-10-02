/** Parameter panel: rendered from /v1/meta so new server capabilities show up
 * without a playground release (design doc section 8).
 *
 * Layout: the everyday fields stay visible; icon path / display overrides /
 * placeholder language / API base live behind 高级选项 so the form reads as a
 * short list instead of a wall of controls. */

import { useState } from "react";
import { Field, Select, TextInput, Button } from "./ui.js";
import type { Meta, ParamState } from "../lib/api.js";

const META_LABELS: Record<string, string> = {
  stars: "Star",
  forks: "Fork",
  issues: "Issue",
  release: "Release",
  full_name: "仓库全名",
  license: "许可证",
  language: "主要语言",
  last_updated: "代码更新日期",
};

export function ParamPanel({
  meta,
  state,
  patch,
  onRefreshMeta,
  metaError,
}: {
  meta: Meta | null;
  state: ParamState;
  patch: (p: Partial<ParamState>) => void;
  onRefreshMeta: () => void;
  metaError: string | null;
}) {
  // the server picks grokbot/avatar from the icon source when no template is
  // pinned; mirror that here so the panel shows the effective template
  const autoId = state.icon === "avatar" ? "avatar" : "grokbot";
  const template =
    meta?.templates.find((t) => t.id === (state.template ?? autoId)) ?? meta?.templates[0] ?? null;
  const limits = meta?.limits;
  const scaleMin = limits?.scaleMin ?? 0.1;
  const declaredMeta = template?.metaFields ?? [];
  const effectiveMeta =
    state.meta === null ? (template?.defaultMetaFields ?? declaredMeta) : state.meta.split(",").map((f) => f.trim()).filter(Boolean);
  const toggleMeta = (field: string, on: boolean) => {
    const next = on ? [...effectiveMeta, field] : effectiveMeta.filter((f) => f !== field);
    patch({ meta: next.join(",") });
  };
  // shared links that carry advanced overrides should show them without a click
  const advancedActive =
    state.iconPath !== "" ||
    state.iconFit !== null ||
    state.iconRound !== null ||
    state.lang !== null ||
    state.apiBase !== "";
  const scale = state.scale ?? 0.5;
  const [advOpen, setAdvOpen] = useState(advancedActive);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Owner">
          <TextInput
            value={state.owner}
            onChange={(e) => patch({ owner: e.target.value })}
            placeholder="Moemu"
            spellCheck={false}
          />
        </Field>
        <Field label="Repo">
          <TextInput
            value={state.repo}
            onChange={(e) => patch({ repo: e.target.value })}
            placeholder="Erika"
            spellCheck={false}
          />
        </Field>
      </div>

      {metaError && (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 p-2 text-xs text-red-300">
          无法获取 /v1/meta：{metaError}
          <Button className="ml-2" onClick={onRefreshMeta}>重试</Button>
        </p>
      )}

      {meta && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="模板">
              <Select
                value={state.template ?? ""}
                onChange={(e) => patch({ template: e.target.value || null })}
                options={[
                  { value: "", label: "自动（按图标来源）" },
                  ...meta.templates.map((t) => ({ value: t.id, label: t.id })),
                ]}
              />
            </Field>
            <Field label="主题">
              <Select
                value={state.theme ?? ""}
                onChange={(e) => patch({ theme: e.target.value || null })}
                options={[
                  { value: "", label: "跟随预设" },
                  ...(template?.themes ?? ["dark", "light"]).map((t) => ({
                    value: t,
                    label: t === "dark" ? "暗色" : t === "light" ? "亮色" : t,
                  })),
                ]}
              />
            </Field>
          </div>

          <Field label="标题覆盖" hint={`≤ ${limits?.title ?? 25} 字，留空用仓库名`}>
            <TextInput
              value={state.title}
              maxLength={limits?.title ?? 25}
              onChange={(e) => patch({ title: e.target.value })}
              spellCheck={false}
            />
          </Field>

          <Field label="描述覆盖" hint={`≤ ${limits?.description ?? 180} 字，留空用仓库描述`}>
            <textarea
              value={state.description}
              maxLength={limits?.description ?? 180}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-sm text-ink-100 placeholder:text-ink-600 transition-colors focus:border-brand-500/70 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
            />
          </Field>

          <Field
            label={`输出缩放 ${scale.toFixed(2)}`}
            hint={
              template
                ? `${Math.round(template.canvas.width * scale)}×${Math.round(template.canvas.height * scale)}`
                : undefined
            }
          >
            <input
              type="range"
              min={scaleMin}
              max={limits?.scaleMax ?? 1}
              step={0.05}
              value={scale}
              onChange={(e) => patch({ scale: Number(e.target.value) })}
              className="w-full accent-brand-500"
            />
          </Field>

          <Field label="图标来源" hint="头像会自动切换模板">
            <Select
              value={state.icon ?? ""}
              onChange={(e) => patch({ icon: e.target.value || null })}
              options={[
                { value: "", label: "自动（项目图标优先）" },
                { value: "builtin", label: "默认图标" },
                { value: "avatar", label: "GitHub 头像" },
              ]}
            />
          </Field>

          <section aria-labelledby="icon-guide-heading" className="space-y-2 rounded-lg border border-brand-300/50 bg-brand-200/30 p-2.5 text-xs leading-relaxed text-ink-300">
            <h2 id="icon-guide-heading" className="font-medium text-ink-100">为项目制作 Grokbot 插画</h2>
            <a
              href="https://grokbot-icon-studio.serio-ai.chatgpt.site/zh-hans"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded text-brand-600 underline underline-offset-4 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              打开 Grokbot Icon Studio 提示词页面 ↗
            </a>
            <details>
              <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">生成后如何使用?</summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                <li>获取提示词，配合角色参考图，在 ChatGPT 等图片生成工具中制作插画。</li>
                <li>将图片保存到目标仓库的默认分支，例如 <code>assets/grokbot-icon.png</code>。亮暗主题共用时建议使用透明 PNG 或 WebP。</li>
                <li>填写上方 Owner 和 Repo，图标来源选择“自动”。其他文件名可在“高级选项 → 项目图标路径”中指定。</li>
              </ol>
              <p className="mt-2">
                提示词来自{" "}
                <a href="https://x.com/Multi_Serio_Ai/status/2100800237619347535" target="_blank" rel="noopener noreferrer" className="rounded text-brand-600 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">@Multi_Serio_Ai</a>。
              </p>
            </details>
          </section>

          <Field label="元数据">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
              {(template?.metaFields ?? []).map((field) => (
                <label key={field} className="flex items-center gap-1.5 text-xs text-ink-300">
                  <input
                    type="checkbox"
                    checked={effectiveMeta.includes(field)}
                    onChange={(e) => toggleMeta(field, e.target.checked)}
                    className="accent-brand-500"
                  />
                  {META_LABELS[field] ?? field}
                </label>
              ))}
              {(template?.metaFields ?? []).length === 0 && (
                <span className="text-xs text-ink-600">该模板未声明元数据字段</span>
              )}
            </div>
          </Field>

          <details
            open={advOpen}
            onToggle={(e) => setAdvOpen((e.target as HTMLDetailsElement).open)}
            className="group rounded-lg border border-ink-700 bg-ink-900"
          >
            <summary className="cursor-pointer select-none rounded-md px-2.5 py-2 text-xs text-ink-300 transition-colors hover:text-ink-100">
              高级选项
            </summary>
            <div className="space-y-3 border-t border-ink-700 p-2.5">
              <Field label="项目图标路径" hint="仓库内相对路径">
                <TextInput
                  value={state.iconPath}
                  onChange={(e) => patch({ iconPath: e.target.value })}
                  placeholder="assets/grokbot-icon.webp"
                  spellCheck={false}
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="图标展示">
                  <Select
                    value={state.iconFit ?? ""}
                    onChange={(e) => patch({ iconFit: e.target.value || null })}
                    options={[
                      { value: "", label: "跟随模板" },
                      { value: "contain", label: "完整展示" },
                      { value: "cover", label: "裁剪填满" },
                    ]}
                  />
                </Field>
                <Field label="圆形裁剪">
                  <Select
                    value={state.iconRound ?? ""}
                    onChange={(e) => patch({ iconRound: e.target.value || null })}
                    options={[
                      { value: "", label: "跟随模板" },
                      { value: "1", label: "圆形" },
                      { value: "0", label: "方形" },
                    ]}
                  />
                </Field>
              </div>

              <Field label="占位图语言">
                <Select
                  value={state.lang ?? ""}
                  onChange={(e) => patch({ lang: e.target.value || null })}
                  options={[
                    { value: "", label: "跟随界面" },
                    { value: "zh", label: "中文" },
                    { value: "en", label: "English" },
                  ]}
                />
              </Field>

              <Field label="API 基址" hint="留空 = 同源">
                <TextInput
                  value={state.apiBase}
                  onChange={(e) => patch({ apiBase: e.target.value })}
                  placeholder={window.location.origin}
                  spellCheck={false}
                />
              </Field>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

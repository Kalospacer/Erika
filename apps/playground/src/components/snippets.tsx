/** Snippet export: Markdown / dual-theme <picture> / plain URL, built from the
 * current absolute API URL. */

import { useState } from "react";
import { CopyButton, Tabs } from "./ui.js";
import { absoluteUrl, type ParamState } from "../lib/api.js";

export function Snippets({ state, path }: { state: ParamState; path: string }) {
  const [tab, setTab] = useState("markdown");
  const url = absoluteUrl(state.apiBase, path);
  // dual-theme snippet is independent of the current preview scheme:
  // dark source + light fallback covers both GitHub schemes deterministically
  const withTheme = (theme: "dark" | "light") => {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("theme", theme);
    return u.toString();
  };

  const markdown = `![${state.repo || "repository banner"}](${url})`;
  const html = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${withTheme("dark")}" />
  <img src="${withTheme("light")}" alt="${state.repo || "repository banner"}" />
</picture>`;

  const content = tab === "markdown" ? markdown : tab === "html" ? html : url;

  return (
    <div className="space-y-2">
      <Tabs
        tabs={[
          { id: "markdown", label: "Markdown" },
          { id: "html", label: "HTML <picture>" },
          { id: "url", label: "URL" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-ink-700 bg-ink-850 p-2.5 font-mono text-xs text-ink-300">
          {content}
        </pre>
        <CopyButton text={content} />
      </div>
      {tab === "html" && (
        <p className="text-xs text-ink-600">
          GitHub 会按亮暗主题选择图片。透明插画直接融合；不透明插画底色与主题不匹配时，使用圆角插画区。
        </p>
      )}
    </div>
  );
}

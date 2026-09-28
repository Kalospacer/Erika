/** Erika Playground — URL is state, preview is production. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchBanner, fetchMeta, bannerPath, type Meta, type PreviewImage } from "./lib/api.js";
import { readStateFromUrl, writeStateToUrl } from "./lib/url-state.js";
import { ParamPanel } from "./components/param-panel.js";
import { PreviewStage } from "./components/preview-stage.js";
import { Snippets } from "./components/snippets.js";
import { Button, CopyButton } from "./components/ui.js";
import { Sun, Moon, Maximize2, Minimize2, RotateCcw } from "lucide-react";

const DEFAULT_STATE = {
  owner: "Moemu",
  repo: "Muika-After-Story",
  template: null,
  theme: null,
  title: "",
  description: "",
  scale: null,
  icon: null,
  iconPath: "",
  iconFit: null,
  iconRound: null,
  meta: null,
  lang: null,
  scheme: "dark" as const,
  apiBase: "",
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function App() {
  const [state, setState] = useState(() => ({ ...DEFAULT_STATE, ...readStateFromUrl() }));
  const patch = useCallback((p: Partial<typeof state>) => {
    setState((old) => ({ ...old, ...p }));
  }, []);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaTick, setMetaTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setMetaError(null);
    fetchMeta(state.apiBase || "", ctrl.signal)
      .then(setMeta)
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setMetaError(err instanceof Error ? err.message : String(err));
      });
    return () => ctrl.abort();
  }, [state.apiBase, metaTick]);

  useEffect(() => {
    writeStateToUrl(state);
  }, [state]);

  const path = useMemo(() => bannerPath(state), [state]);
  const debouncedPath = useDebounced(path, 300);
  const [image, setImage] = useState<PreviewImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!debouncedPath) {
      setImage(null);
      return;
    }
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setLoading(true);
    setPreviewError(null);
    fetchBanner(state.apiBase || "", debouncedPath, ctrl.signal)
      .then((r) => {
        setImage((old) => {
          if (old) URL.revokeObjectURL(old.blobUrl);
          return r;
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setPreviewError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPath, state.apiBase]);

  const autoTemplate = state.icon === "avatar" ? "avatar" : "grokbot";
  const template = meta?.templates.find((t) => t.id === (state.template ?? autoTemplate)) ?? null;

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 lg:flex-row">
      {/* main column */}
      <main className="min-w-0 flex-1 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="blossom text-2xl" aria-hidden="true" />
            <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              Erika
            </span>
            <span className="text-sm font-normal text-ink-300">（絵里香）· Playground</span>
          </h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => patch({ scheme: state.scheme === "dark" ? "light" : "dark" })}>
              {state.scheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {state.scheme === "dark" ? "亮色模拟" : "暗色模拟"}
            </Button>
            <Button onClick={() => patch({ scale: state.scale == null ? 1 : null })} title="原始尺寸 = scale 1">
              {state.scale == null ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              {state.scale == null ? "查看原始尺寸" : "回到 README 比例"}
            </Button>
          </div>
        </header>

        <PreviewStage
          image={image}
          loading={loading}
          error={previewError}
          scheme={state.scheme}
          raw={state.scale === 1}
          scale={state.scale ?? 0.5}
          canvas={template?.canvas ?? null}
        />

        {path && <Snippets state={state} path={path} />}

        <p className="text-xs text-ink-600">预览取自真实 API 响应；URL 即配置，可直接分享。</p>
      </main>

      {/* side panel */}
      <aside className="panel w-full shrink-0 space-y-4 p-4 lg:w-80">
        <ParamPanel
          meta={meta}
          metaError={metaError}
          state={state}
          patch={patch}
          onRefreshMeta={() => setMetaTick((t) => t + 1)}
        />

        <div className="flex gap-2 border-t border-ink-700 pt-3">
          <CopyButton
            text={path ? `${(state.apiBase || window.location.origin).replace(/\/$/, "")}${path}` : ""}
            label="复制图片 URL"
          />
          <Button onClick={() => setState({ ...DEFAULT_STATE })} title="恢复演示配置">
              <RotateCcw size={14} /> 重置
            </Button>
        </div>
      </aside>
    </div>
  );
}


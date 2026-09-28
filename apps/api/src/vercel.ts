/** Vercel Function wiring (community Route A): packaged in @erika/api so the
 * root api/index.ts entry imports node_modules only -- no cross-workspace
 * relative imports, no CJS/ESM boundary crossing.
 * The provider comes from the package entry (dist) so error-class identity
 * matches the app's instanceof checks. */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { handle } from "@hono/node-server/vercel";
import { createApp } from "./app.js";
import { DEFAULT_PRESETS_PATH, DEFAULT_TEMPLATES_DIR } from "@erika/core";
import { createGitHubProvider } from "@erika/providers";

export interface VercelEnv {
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  fetchImpl?: typeof fetch;
}

/** 资产路径解析：环境变量 → cwd 相对（Vercel /var/task）→ core 绝对默认
 * （仓库 / Docker 布局）。任一命中即返回，保证三种运行形态都能解析。 */
function resolveAssetPath(envVar: string, cwdRel: string, fallback: string): string {
  if (process.env[envVar]) return process.env[envVar] as string;
  if (existsSync(join(process.cwd(), cwdRel))) return join(process.cwd(), cwdRel);
  return fallback;
}

export function createVercelApp(env: VercelEnv = {}) {
  const provider = createGitHubProvider({
    token: env.GITHUB_TOKEN ?? env.GH_TOKEN,
    fetchImpl: env.fetchImpl,
    log: (msg: string) => console.log(`[provider] ${msg}`),
  });
  return createApp({
    provider,
    templatesDir: resolveAssetPath("ERIKA_TEMPLATES_DIR", "packages/templates", DEFAULT_TEMPLATES_DIR),
    presetsPath: resolveAssetPath("ERIKA_PRESETS_PATH", "apps/api/presets/presets.json", DEFAULT_PRESETS_PATH),
    fontsDir: resolveAssetPath("ERIKA_FONTS_DIR", "packages/templates/fonts", join(DEFAULT_TEMPLATES_DIR, "fonts")),
    log: (msg: string) => console.log(`[api] ${msg}`),
  });
}

/** Vercel's default function export must write to the Node response stream. */
export function createVercelHandler(env: VercelEnv = {}) {
  return handle(createVercelApp(env));
}

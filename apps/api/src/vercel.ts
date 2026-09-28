/** Vercel Function wiring (community Route A): packaged in @erika/api so the
 * root api/index.ts entry imports node_modules only -- no cross-workspace
 * relative imports, no CJS/ESM boundary crossing.
 * The provider comes from the package entry (dist) so error-class identity
 * matches the app's instanceof checks. */

import { handle } from "hono/vercel";
import { createApp } from "./app.js";
import { createGitHubProvider } from "@erika/providers";

export interface VercelEnv {
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  fetchImpl?: typeof fetch;
}

export function createVercelApp(env: VercelEnv = {}) {
  const provider = createGitHubProvider({
    token: env.GITHUB_TOKEN ?? env.GH_TOKEN,
    fetchImpl: env.fetchImpl,
    log: (msg: string) => console.log(`[provider] ${msg}`),
  });
  // Vercel cwd = /var/task；includeFiles 会把仓库同构路径拷入，
  // 因此这里用 cwd 相对默认值（可用 ERIKA_* 环境变量覆盖）
  return createApp({
    provider,
    templatesDir: process.env.ERIKA_TEMPLATES_DIR ?? "packages/templates",
    presetsPath: process.env.ERIKA_PRESETS_PATH ?? "apps/api/presets/presets.json",
    fontsDir: process.env.ERIKA_FONTS_DIR ?? "packages/templates/fonts",
    log: (msg: string) => console.log(`[api] ${msg}`),
  });
}

/** hono/vercel 的 handle 接收 Hono 实例（不是 app.fetch）。 */
export function createVercelHandler(env: VercelEnv = {}) {
  return handle(createVercelApp(env));
}

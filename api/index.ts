/** Vercel Function entry (community Route A: one-click deploy).
 * The provider is imported from the package entry (dist) so the error classes
 * are the same objects the app's instanceof checks compare against; a src
 * import would break the not-found/rate-limited classification. Live Vercel
 * validation remains an M4 item (bundle paths, cold start). */

import { handle } from "hono/vercel";
import { join } from "node:path";
import { createApp } from "../apps/api/src/app.js";
import { createGitHubProvider } from "@erika/providers";

export function createVercelApp(
  env: { GITHUB_TOKEN?: string; fetchImpl?: typeof fetch } = {},
) {
  const provider = createGitHubProvider({
    token: env.GITHUB_TOKEN,
    fetchImpl: env.fetchImpl,
    log: (msg: string) => console.log(`[provider] ${msg}`),
  });
  return createApp({
    provider,
    templatesDir: process.env.ERIKA_TEMPLATES_DIR ?? join(process.cwd(), "packages/templates"),
    presetsPath: process.env.ERIKA_PRESETS_PATH ?? join(process.cwd(), "apps/api/presets/presets.json"),
    fontsDir: process.env.ERIKA_FONTS_DIR ?? join(process.cwd(), "packages/templates/fonts"),
    log: (msg) => console.log(`[api] ${msg}`),
  });
}

const app = createVercelApp({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
});
export default handle(app);

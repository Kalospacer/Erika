/** Vercel Function entry (community Route A: one-click deploy).
 * The provider is imported from the package entry (dist) so the error classes
 * are the same objects the app's instanceof checks compare against; a src
 * import would break the not-found/rate-limited classification. Live Vercel
 * validation remains an M4 item (bundle paths, cold start). */

import { handle } from "hono/vercel";
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
    templatesDir: process.env.ERIKA_TEMPLATES_DIR,
    presetsPath: process.env.ERIKA_PRESETS_PATH,
    fontsDir: process.env.ERIKA_FONTS_DIR,
    log: (msg) => console.log(`[api] ${msg}`),
  });
}

const app = createVercelApp({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
});
export default handle(app);

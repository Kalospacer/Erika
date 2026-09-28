/** Erika API server entry: env config + wiring. */

import { join } from "node:path";
import { serve } from "@hono/node-server";
import { createGitHubProvider } from "@erika/providers";
import { DEFAULT_PRESETS_PATH, REPO_ROOT } from "@erika/core";
import { createApp } from "./app.js";

// local configuration: the repo-root .env (copy .env.example). Values already
// present in the process environment win, so CI/platform env vars are not
// overridden; a missing file is fine.
try {
  process.loadEnvFile(join(REPO_ROOT, ".env"));
} catch {
  // no .env -- rely on the process environment
}

const port = Number(process.env.PORT ?? 8787);
// GITHUB_TOKEN is the documented name; GH_TOKEN matches the gh CLI convention
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

if (!token) {
  console.warn(
    "[erika] GITHUB_TOKEN is not set: unauthenticated GitHub quota is 60 req/h and " +
      "production traffic WILL be rate limited. Copy .env.example to .env and fill it in " +
      "(design doc 6.2).",
  );
} else {
  console.log(`[erika] GitHub token configured (${mask(token)})`);
}

/** Never log a full credential: show shape + last 4 chars only. */
function mask(value: string): string {
  return value.length <= 8 ? "****" : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const provider = createGitHubProvider({
  token,
  freshTtlMs: envMs("ERIKA_FRESH_TTL_MS", 30 * 60_000),
  maxStaleMs: envMs("ERIKA_MAX_STALE_MS", 48 * 60 * 60_000),
  notFoundTtlMs: envMs("ERIKA_NOT_FOUND_TTL_MS", 60 * 60_000),
  transientTtlMs: envMs("ERIKA_TRANSIENT_TTL_MS", 60_000),
  log: (msg) => console.log(`[provider] ${msg}`),
});

const app = createApp({
  provider,
  templatesDir: process.env.ERIKA_TEMPLATES_DIR,
  presetsPath: process.env.ERIKA_PRESETS_PATH ?? DEFAULT_PRESETS_PATH,
  fontsDir: process.env.ERIKA_FONTS_DIR,
  cacheMaxBytes: process.env.ERIKA_RENDER_CACHE_MB
    ? Number(process.env.ERIKA_RENDER_CACHE_MB) * 1024 * 1024
    : undefined,
  log: (msg) => console.log(`[api] ${msg}`),
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[erika] listening on http://localhost:${info.port}`);
});

function envMs(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

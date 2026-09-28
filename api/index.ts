/** Vercel Function entry (community Route A: one-click deploy).
 * Thin on purpose: all wiring lives in @erika/api/vercel so the module format
 * matches the deployed package (ESM) and the root entry stays small.
 *
 * 签名说明：Vercel Node.js 运行时对 api/ 目录函数默认按 (req, res) 处理，
 * 返回值会被忽略（→ 15s 超时）。这里显式使用 Web fetch 风格——收 Request、
 * 返 Response——运行时即按新签名处理（见 functions-api-reference）。 */

import { createVercelApp } from "@erika/api/vercel";

// re-exported so CI tests exercise the exact deployed factory
export { createVercelApp } from "@erika/api/vercel";

const app = createVercelApp({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GH_TOKEN: process.env.GH_TOKEN,
});

export default async function fetchHandler(request: Request): Promise<Response> {
  return app.fetch(request);
}

/** Vercel Function entry (community Route A: one-click deploy).
 * Thin on purpose: all wiring lives in @erika/api/vercel so the module format
 * matches the deployed package (ESM) and the root entry stays small.
 * The Node adapter converts req/res to Hono's Web APIs and ends the response.
 * Returning a Web Response from a bare default function leaves requests open. */

import { createVercelHandler } from "@erika/api/vercel";

// re-exported so CI tests exercise the exact deployed factory
export { createVercelApp } from "@erika/api/vercel";

export default createVercelHandler({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GH_TOKEN: process.env.GH_TOKEN,
});

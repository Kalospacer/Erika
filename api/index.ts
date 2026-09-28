/** Vercel Function entry (community Route A: one-click deploy).
 * Thin on purpose: all wiring lives in @erika/api/vercel so the module format
 * matches the deployed package (ESM) and the root entry stays 3 lines.
 * Live Vercel validation items (bundle paths, cold start) -- see design doc 10.0. */

import { createVercelHandler } from "@erika/api/vercel";

export default createVercelHandler({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GH_TOKEN: process.env.GH_TOKEN,
});

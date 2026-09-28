/** Deployment entry (api/index.ts) must keep the error taxonomy: the provider
 * must come from the package entry so error-class identity matches. */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { REPO_ROOT } from "@erika/core";

let entry: typeof import("../../../api/index.js");
const cwd = vi.spyOn(process, "cwd");
beforeAll(async () => {
  // Vercel runs the function from the configured project root.
  cwd.mockReturnValue(REPO_ROOT);
  entry = await import("../../../api/index.js");
});
afterAll(() => cwd.mockRestore());

function gh404() {
  return new Response("{}", { status: 404 });
}

describe("createVercelApp (route A entry)", () => {
  it("classifies upstream 404 into a placeholder image, not a 500", async () => {
    const app = entry.createVercelApp({ fetchImpl: gh404 });
    const res = await app.request("/v1/banner/No/Such.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-banner-error")).toBe("not-found");
    expect(res.headers.get("content-type")).toBe("image/webp");
  });
});

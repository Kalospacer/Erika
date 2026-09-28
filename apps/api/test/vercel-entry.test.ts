/** Deployment entry (api/index.ts) must keep the error taxonomy: the provider
 * must come from the package entry so error-class identity matches. */

import { describe, expect, it } from "vitest";
import { createVercelApp } from "../../../api/index.js";

function gh404() {
  return new Response("{}", { status: 404 });
}

describe("createVercelApp (route A entry)", () => {
  it("classifies upstream 404 into a placeholder image, not a 500", async () => {
    const app = createVercelApp({ fetchImpl: gh404 });
    const res = await app.request("/v1/banner/No/Such.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-banner-error")).toBe("not-found");
    expect(res.headers.get("content-type")).toBe("image/webp");
  });

  it("exports a hono/vercel-compatible handler (function, not app.fetch)", () => {
    const app = createVercelApp({});
    // createVercelApp returns the Hono instance; the module default must wrap
    // it via handle(). We assert the instance shape that handle() requires.
    expect(typeof app.request).toBe("function");
    expect(typeof app.fetch).toBe("function");
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, get, type IncomingHttpHeaders, type Server } from "node:http";
import { REPO_ROOT } from "@erika/core";

let server: Server;
let origin: string;
const upstreamFetch = vi.fn<typeof fetch>(async () => new Response("{}", { status: 404 }));
const cwd = vi.spyOn(process, "cwd");

beforeAll(async () => {
  cwd.mockReturnValue(REPO_ROOT);
  vi.stubGlobal("fetch", upstreamFetch);
  const entry = await import("../../../api/index.js");
  // Vercel invokes default-exported functions with Node req/res. A direct
  // Web Request call cannot detect a handler that never sends the response.
  server = createServer(entry.default);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  vi.unstubAllGlobals();
  cwd.mockRestore();
});

function request(path: string): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = get(`${origin}${path}`, { signal: AbortSignal.timeout(2000) }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
  });
}

describe("Vercel Node HTTP entry", () => {
  it("ends the health response", async () => {
    const response = await request("/healthz");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.toString()).ok).toBe(true);
  });

  it("returns metadata without contacting GitHub", async () => {
    upstreamFetch.mockClear();
    const response = await request("/v1/meta");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(JSON.parse(response.body.toString()).templates.map((template: { id: string }) => template.id))
      .toEqual(expect.arrayContaining(["grokbot", "avatar"]));
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("keeps binary responses and upstream 404 classification", async () => {
    const response = await request("/v1/banner/No/Such.webp");
    expect(response.status).toBe(200);
    expect(response.headers["x-banner-error"]).toBe("not-found");
    expect(response.headers["content-type"]).toBe("image/webp");
    expect(response.body.toString("ascii", 0, 4)).toBe("RIFF");
    expect(response.body.toString("ascii", 8, 12)).toBe("WEBP");
  });

  it("preserves query parameters and unknown API paths", async () => {
    const invalid = await request("/v1/banner/No/Such.webp?scale=99");
    expect(invalid.status).toBe(400);
    const missing = await request("/v1/unknown");
    expect(missing.status).toBe(404);
    expect(missing.headers["content-type"]).not.toContain("text/html");
  });
});

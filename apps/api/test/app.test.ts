/** API integration tests: the M2 key acceptance is the "same README URL
 * updates after repo data changes + degrades per policy on GitHub failure". */

import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TEMPLATES_DIR } from "@erika/core";
import { LIMITS } from "@erika/shared";
import { createApp } from "../src/app.js";
import type { GitHubProvider, RepoSnapshot } from "@erika/providers";
import { NotFoundError, UpstreamError } from "@erika/providers";

/** Scriptable fake provider: snapshots queue + error injection. */
function fakeProvider() {
  const queue: Array<RepoSnapshot | Error> = [];
  const calls = 0;
  const provider: GitHubProvider = {
    async getRepo() {
      const next = queue.shift();
      if (!next) throw new Error("fake provider queue empty");
      if (next instanceof Error) throw next;
      return next;
    },
    stats: () => ({ snapshots: queue.length, notFound: calls, transientBackoff: 0 }),
  };
  return { provider, queue };
}

function snapshot(stars: number, versionSuffix = ""): RepoSnapshot {
  return {
    freshness: "fresh",
    version: `v${stars}${versionSuffix}`,
    data: {
      fullName: "Moemu/Muika-After-Story",
      name: "Muika-After-Story",
      description: "An event-loop Chatbot framework\nbased on an emotional state machine,\nwith its character design inspired\nby Monika from Doki Doki Literature Club.",
      stargazersCount: stars,
      forksCount: 1,
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      private: false,
    },
  };
}

function buildApp(queue: Array<RepoSnapshot | Error>) {
  return createApp({
    provider: {
      getRepo: async () => {
        const next = queue.shift();
        if (!next) throw new Error("queue empty");
        if (next instanceof Error) throw next;
        return next;
      },
      stats: () => ({ snapshots: 0, notFound: 0, transientBackoff: 0 }),
    },
    // the icon chain would hit raw.githubusercontent.com; tests serve the local
    // fixture instead, so the repo-icon path is exercised without network
    imageFetcher: async (url: string) => {
      if (url.includes("avatars.githubusercontent.com")) throw new Error("no avatars in these tests");
      return readFileSync(join(DEFAULT_TEMPLATES_DIR, "assets", "muika-icon.webp"));
    },
    cacheMaxBytes: 64 * 1024 * 1024,
  });
}

describe("GET /v1/banner", () => {
  let queue: Array<RepoSnapshot | Error>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    queue = [];
    app = buildApp(queue);
  });

  it("renders a webp with ETag + cache headers", async () => {
    queue.push(snapshot(9));
    const res = await app.request("/v1/banner/Moemu/Muika-After-Story.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{32}"$/);
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-expose-headers")).toContain("X-Banner-Error");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(10_000);
  });

  it("revalidates with ETag: identical payload -> 304", async () => {
    const snap = snapshot(9);
    queue.push(snap, snap);
    const res1 = await app.request("/v1/banner/Moemu/Muika-After-Story.webp");
    const etag = res1.headers.get("etag")!;
    const res2 = await app.request("/v1/banner/Moemu/Muika-After-Story.webp", {
      headers: { "If-None-Match": etag },
    });
    expect(res2.status).toBe(304);
  });

  it("KEY ACCEPTANCE: same URL updates after data change (new ETag, new bytes)", async () => {
    // stars are VISIBLE by default (the template declares the footer row)
    queue.push(snapshot(9), snapshot(42, "-b"), snapshot(42, "-b"));
    const url = "/v1/banner/Moemu/Muika-After-Story.webp";
    const res1 = await app.request(url);
    const etag1 = res1.headers.get("etag")!;
    const bytes1 = await res1.arrayBuffer();

    const res2 = await app.request(url);
    const etag2 = res2.headers.get("etag")!;
    const bytes2 = await res2.arrayBuffer();

    expect(etag2).not.toBe(etag1);
    expect(Buffer.compare(Buffer.from(bytes1), Buffer.from(bytes2))).not.toBe(0);

    // a conditional request against the OLD etag now re-downloads (200)
    const res3 = await app.request(url, { headers: { "If-None-Match": etag1 } });
    expect(res3.status).toBe(200);
  });

  it("invariant: with metadata off (?meta=) a stars-only change keeps the bytes", async () => {
    queue.push(snapshot(9), snapshot(42, "-b"));
    const url = "/v1/banner/Moemu/Muika-After-Story.webp?meta=";
    const res1 = await app.request(url);
    const res2 = await app.request(url);
    // ETag is the image-bytes hash: with no metadata row the render is identical
    // bytes, so the ETag stays equal even though the data version changed.
    expect(res2.headers.get("etag")).toBe(res1.headers.get("etag"));
    expect(Buffer.compare(Buffer.from(await res1.arrayBuffer()), Buffer.from(await res2.arrayBuffer()))).toBe(0);
  });

  it("metadata rows are opt-out: ?meta= renders a different image", async () => {
    queue.push(snapshot(9), snapshot(9));
    const withRows = await app.request("/v1/banner/Moemu/Muika-After-Story.webp");
    const without = await app.request("/v1/banner/Moemu/Muika-After-Story.webp?meta=");
    expect(without.status).toBe(200);
    expect(without.headers.get("etag")).not.toBe(withRows.headers.get("etag"));
  });

  it("description accent markers survive the query path and change the bytes only by colour", async () => {
    queue.push(snapshot(9), snapshot(9));
    const plain = await app.request(
      "/v1/banner/Moemu/Muika-After-Story.webp?description=A%20Nonebot%202%20plugin",
    );
    const marked = await app.request(
      "/v1/banner/Moemu/Muika-After-Story.webp?description=A%20**Nonebot%202**%20plugin",
    );
    expect(marked.status).toBe(200);
    expect(marked.headers.get("etag")).not.toBe(plain.headers.get("etag"));
  });

  it("not-found repo -> placeholder image with X-Banner-Error + normal cache", async () => {
    queue.push(new NotFoundError("No/Such"));
    const res = await app.request("/v1/banner/No/Such.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-banner-error")).toBe("not-found");
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(res.headers.get("content-type")).toBe("image/webp");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(5_000);
  });

  it("rate limited without stale -> transient placeholder with short cache", async () => {
    queue.push(new UpstreamError("rate-limited", "limited", 120));
    const res = await app.request("/v1/banner/Moemu/Muika-After-Story.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-banner-error")).toBe("upstream-rate-limited");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
  });

  it("serves stale data when the provider says so (degradation path)", async () => {
    const stale = { ...snapshot(9), freshness: "stale" as const };
    queue.push(stale);
    const res = await app.request("/v1/banner/Moemu/Muika-After-Story.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-banner-error")).toBeNull();
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
  });

  it("fresh=1 switches the response to revalidate-always", async () => {
    queue.push(snapshot(9));
    const res = await app.request("/v1/banner/Moemu/Muika-After-Story.webp?fresh=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("validates params: bad scale / long title / unknown template / unknown theme", async () => {
    queue.push(snapshot(9));
    const badScale = await app.request("/v1/banner/Moemu/Muika-After-Story.webp?scale=2");
    expect(badScale.status).toBe(400);
    const longTitle = await app.request(
      `/v1/banner/Moemu/Muika-After-Story.webp?title=${"x".repeat(LIMITS.titleChars + 1)}`,
    );
    expect(longTitle.status).toBe(400);
    const longDesc = await app.request(
      `/v1/banner/Moemu/Muika-After-Story.webp?description=${"x".repeat(LIMITS.descriptionChars + 1)}`,
    );
    expect(longDesc.status).toBe(400);
    const badTemplate = await app.request("/v1/banner/Moemu/Muika-After-Story/nope.webp");
    expect(badTemplate.status).toBe(400);
    const badTheme = await app.request("/v1/banner/Moemu/Muika-After-Story.webp?theme=sepia");
    expect(badTheme.status).toBe(400);
    const badExt = await app.request("/v1/banner/Moemu/Muika-After-Story.gif");
    expect(badExt.status).toBe(400);
  });

  it("zh placeholder message for not-found with lang=zh", async () => {
    queue.push(new NotFoundError("No/Such"));
    const res = await app.request("/v1/banner/No/Such.webp?lang=zh");
    expect(res.headers.get("x-banner-error")).toBe("not-found");
    expect(res.status).toBe(200);
  });

  it("repo names with dots survive extension parsing", async () => {
    queue.push({ ...snapshot(5), data: { ...snapshot(5).data, name: "next.js", fullName: "vercel/next.js" }, version: "nextjs" });
    const res = await app.request("/v1/banner/vercel/next.js.webp");
    expect(res.status).toBe(200);
  });
});

describe("GET /v1/meta", () => {
  it("lists templates with capabilities", async () => {
    const app = buildApp([]);
    const res = await app.request("/v1/meta");
    expect(res.status).toBe(200);
    const meta = (await res.json()) as {
      templates: Array<{ id: string; capabilities: { metadata: boolean }; sources: string[]; metaFields: string[] }>;
      metaFields: string[];
    };
    const ids = meta.templates.map((t) => t.id);
    expect(ids).toContain("grokbot");
    expect(ids).toContain("avatar");
    const grokbot = meta.templates.find((t) => t.id === "grokbot")!;
    expect(grokbot.capabilities.metadata).toBe(true);
    expect(grokbot.sources).toEqual(["repo", "builtin"]);
    expect(grokbot.metaFields).toEqual(["full_name", "stars", "forks", "issues", "release"]);
    expect(meta.metaFields).toContain("release");
  });
});

describe("review regressions", () => {
  let queue: Array<RepoSnapshot | Error>;
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    queue = [];
    app = buildApp(queue);
  });

  it("placeholder cache does not mix format or theme", async () => {
    queue.push(new NotFoundError("No/Such"), new NotFoundError("No/Such"));
    const dark = await app.request("/v1/banner/No/Such.webp?theme=dark");
    const light = await app.request("/v1/banner/No/Such.png?theme=light");
    expect(dark.headers.get("content-type")).toBe("image/webp");
    expect(light.headers.get("content-type")).toBe("image/png");
    const dk = Buffer.from(await dark.arrayBuffer());
    const lt = Buffer.from(await light.arrayBuffer());
    expect(Buffer.compare(dk, lt)).not.toBe(0);
  });

  it("unknown meta field -> 400 (service and template agree on the field set)", async () => {
    queue.push(snapshot(9));
    const res = await app.request("/v1/banner/Moemu/Muika-After-Story.webp?meta=bogus");
    expect(res.status).toBe(400);
  });

  it("a meta subset renders a different image than the declared default", async () => {
    queue.push(snapshot(9), snapshot(9));
    const subset = await app.request("/v1/banner/Moemu/Muika-After-Story.webp?meta=stars");
    const all = await app.request("/v1/banner/Moemu/Muika-After-Story.webp");
    expect(subset.status).toBe(200);
    expect(subset.headers.get("etag")).not.toBe(all.headers.get("etag"));
  });

  it("explicit light theme survives preset theme overrides (Rikka dark != light)", async () => {
    // rikka preset overrides dark colors; light must NOT inherit them
    queue.push(snapshot(9), snapshot(9));
    const dark = await app.request("/v1/banner/Moemu/Nonebot-Plugin-Rikka.webp?theme=dark");
    const light = await app.request("/v1/banner/Moemu/Nonebot-Plugin-Rikka.webp?theme=light");
    expect(dark.status).toBe(200);
    expect(light.status).toBe(200);
    const dk = Buffer.from(await dark.arrayBuffer());
    const lt = Buffer.from(await light.arrayBuffer());
    expect(Buffer.compare(dk, lt)).not.toBe(0);
  });

  it("corrupt avatar bytes fall through to the builtin icon (no 500)", async () => {
    const app2 = createApp({
      provider: {
        getRepo: async () => ({
          freshness: "fresh" as const,
          version: "stranger",
          data: {
            fullName: "Some/One",
            name: "One",
            description: "a stranger repo",
            stargazersCount: 3,
            avatarUrl: "https://avatars.githubusercontent.com/u/99?v=4",
            private: false,
          },
        }),
        stats: () => ({ snapshots: 0, notFound: 0, transientBackoff: 0, pausedForMs: 0 }),
      },
      imageFetcher: async () => Buffer.from("this is not an image"),
      cacheMaxBytes: 64 * 1024 * 1024,
    });
    // icon=avatar with corrupt bytes: the chain falls back to the default
    // Grokbot icon and the banner still renders (never a broken image)
    const res = await app2.request("/v1/banner/Some/One.webp?icon=avatar");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
  });
});

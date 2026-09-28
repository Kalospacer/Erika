import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { renderLiveCommand } from "../src/cli.js";
import { DEFAULT_TEMPLATES_DIR, DEFAULT_PRESETS_PATH, REPO_ROOT } from "@erika/core";

/** 1x1 PNG for the repo-icon chain (decode-validated like any icon source). */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function gh200() {
  return new Response(
    JSON.stringify({
      full_name: "Some/One",
      name: "One",
      description: "a stranger repo",
      stargazers_count: 3,
      forks_count: 0,
      private: false,
      owner: { avatar_url: "https://avatars.githubusercontent.com/u/99?v=4" },
    }),
    { status: 200, headers: { etag: '"e1"' } },
  );
}

describe("render-live", () => {
  it("runs the Actions example from a separate user's checkout", () => {
    const workflow = readFileSync(join(REPO_ROOT, "docs/examples/refresh-banner.yml"), "utf8");
    const setting = (key: string) => {
      const value = workflow.match(new RegExp(`^  ${key}: ([^ #\\r\\n]+)`, "m"))?.[1];
      if (!value) throw new Error(`missing workflow setting ${key}`);
      return value;
    };
    const checkout = resolve("out/actions-user-repo");
    mkdirSync(checkout, { recursive: true });
    const result = spawnSync(process.execPath, [
      "--import", pathToFileURL(join(REPO_ROOT, "scripts/fixtures/github.mjs")).href,
      join(REPO_ROOT, "packages/cli/dist/cli.js"), "render-live",
      "--owner", setting("BANNER_OWNER"), "--repo", setting("BANNER_REPO"),
      "--template", setting("BANNER_TEMPLATE"), "--out", setting("BANNER_OUT"),
    ], {
      cwd: checkout, encoding: "utf8", timeout: 15000,
      env: { ...process.env, GITHUB_TOKEN: "fixture", ERIKA_TEMPLATES_DIR: DEFAULT_TEMPLATES_DIR },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain("repo icon candidate failed");
    expect(readFileSync(join(checkout, setting("BANNER_OUT"))).length).toBeGreaterThan(5000);
  });

  it("renders a stranger repo with the repo-icon chain (public interface)", async () => {
    const fetchCalls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      fetchCalls.push(String(url));
      if (String(url).includes("api.github.com")) return gh200();
      if (String(url).includes("raw.githubusercontent.com")) {
        return new Response(TINY_PNG, { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const out = resolve("out/render-live-test/one.webp");
    const code = await renderLiveCommand(
      { owner: "Some", repo: "One", out, scale: "0.5" },
      { templatesDir: DEFAULT_TEMPLATES_DIR, presetsPath: DEFAULT_PRESETS_PATH },
      { fetchImpl, avatarFetchImpl: fetchImpl },
    );
    expect(code).toBe(0);
    const bytes = readFileSync(out);
    expect(bytes.length).toBeGreaterThan(5000);
    // the subject repo's icon was fetched through the public path
    expect(fetchCalls.some((u) => u.includes("raw.githubusercontent.com"))).toBe(true);
    expect(join(out, "")).toBeTruthy();
  }, 20000);

  it("requires owner/repo", async () => {
    await expect(
      renderLiveCommand({}, { templatesDir: DEFAULT_TEMPLATES_DIR, presetsPath: DEFAULT_PRESETS_PATH }),
    ).rejects.toThrow("--owner and --repo are required");
  });
});

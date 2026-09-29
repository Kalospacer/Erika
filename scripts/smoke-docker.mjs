import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const image = process.argv[2] ?? "erika:local";
const name = `erika-smoke-${process.pid}-${Date.now()}`;
const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let started = false;
try {
  docker("run", "--detach", "--rm", "--name", name,
    "--publish", "127.0.0.1::8787",
    "--mount", `type=bind,source=${fixtures},target=/review,readonly`,
    "--env", "NODE_OPTIONS=--import=/review/github.mjs", image);
  started = true;
  const port = docker("port", name, "8787/tcp").split(":").at(-1);
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; }
    } catch { /* server is still starting */ }
    await delay(200);
  }
  assert(ready, "container did not become healthy");
  for (const path of ["/", "/some/nested/page"]) {
    const page = new URL(path, origin);
    const response = await fetch(page);
    assert.equal(response.status, 200);
    const assets = [...(await response.text()).matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)];
    assert(assets.length >= 3, "missing built assets");
    for (const [, asset] of assets) {
      const result = await fetch(new URL(asset, page));
      assert.equal(result.status, 200, asset);
      assert(!result.headers.get("content-type")?.includes("text/html"), asset);
    }
  }
  for (const path of ["/v1", "/v1/unknown", "/assets/missing.js"]) {
    assert.equal((await fetch(origin + path)).status, 404, path);
  }
  const metadata = await (await fetch(`${origin}/v1/meta`)).json();
  assert(metadata.templates.some((t) => t.id === "grokbot"));
  const url = `${origin}/v1/banner/Moemu/Erika.webp`;
  const banner = await fetch(url);
  assert.equal(banner.status, 200);
  assert.equal(banner.headers.get("content-type"), "image/webp");
  assert.equal(banner.headers.get("x-banner-icon"), "repo", "preset icon silently fell back");
  assert((await banner.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(url, { headers: { "If-None-Match": banner.headers.get("etag") } })).status, 304);
  const missing = await fetch(`${origin}/v1/banner/Example/Missing.webp`);
  assert.equal(missing.status, 200);
  assert.equal(missing.headers.get("x-banner-error"), "not-found");
  assert.equal(missing.headers.get("content-type"), "image/webp");
  console.log("Docker smoke passed: static assets, nested SPA, API 404, repo icon, ETag, placeholder.");
} catch (error) {
  if (started) console.error(docker("logs", name));
  throw error;
} finally {
  if (started) docker("stop", "--time", "1", name);
}

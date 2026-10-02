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
    const assets = [...(await response.text()).matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|png|ico|webmanifest))"/g)];
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
  const grokbot = metadata.templates.find((t) => t.id === "grokbot");
  assert(grokbot.metaFields.includes("last_updated"));
  assert(!grokbot.defaultMetaFields.includes("last_updated"));
  const url = `${origin}/v1/banner/Moemu/Erika.webp`;
  const banner = await fetch(url);
  assert.equal(banner.status, 200);
  assert.equal(banner.headers.get("content-type"), "image/webp");
  assert.equal(banner.headers.get("x-banner-icon"), "repo", "preset icon silently fell back");
  assert((await banner.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(url, { headers: { "If-None-Match": banner.headers.get("etag") } })).status, 304);
  const extra = await fetch(`${url}?meta=license,language,last_updated`);
  assert.equal(extra.status, 200);
  assert.equal(extra.headers.get("content-type"), "image/webp");
  assert.notEqual(extra.headers.get("etag"), banner.headers.get("etag"), "selected metadata was not rendered");
  assert((await extra.arrayBuffer()).byteLength > 1000);
  const themeEtags = [];
  for (const theme of ["light", "dark"]) {
    const themed = await fetch(`${origin}/v1/banner/Moemu/Erika.png?theme=${theme}&icon=builtin`);
    assert.equal(themed.status, 200);
    assert.equal(themed.headers.get("content-type"), "image/png");
    assert.equal(themed.headers.get("x-banner-icon"), "builtin", "transparent builtin missing from image");
    assert((await themed.arrayBuffer()).byteLength > 1000);
    themeEtags.push(themed.headers.get("etag"));
  }
  assert.notEqual(themeEtags[0], themeEtags[1], "theme renders share the same image");
  const missing = await fetch(`${origin}/v1/banner/Example/Missing.webp`);
  assert.equal(missing.status, 200);
  assert.equal(missing.headers.get("x-banner-error"), "not-found");
  assert.equal(missing.headers.get("x-banner-icon"), "builtin", "not-found illustration missing from image");
  assert.equal(missing.headers.get("content-type"), "image/webp");
  console.log("Docker smoke passed: static assets, nested SPA, API 404, repo icon, selected metadata, transparent themes, ETag, placeholder.");
} catch (error) {
  if (started) console.error(docker("logs", name));
  throw error;
} finally {
  if (started) docker("stop", "--time", "1", name);
}

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const image = process.argv[2] ?? "erika:local";
const output = fileURLToPath(new URL(`../out/acceptance-${Date.now()}/`, import.meta.url));
mkdirSync(output, { recursive: true });
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const report = { image, at: new Date().toISOString(), environment: { node: process.version, platform: process.platform }, faults: [], load: [] };

async function container(label, env, run) {
  const dir = `${output}/${label}`;
  mkdirSync(dir, { recursive: true });
  copyFileSync(fileURLToPath(new URL("./fixtures/acceptance-upstream.mjs", import.meta.url)), `${dir}/upstream.mjs`);
  const control = (mode, description = "Fixture baseline") => writeFileSync(`${dir}/state.json`, JSON.stringify({ mode, description }));
  control("ok");
  writeFileSync(`${dir}/upstream.jsonl`, "");
  // The production image runs as node; only this synthetic log needs write access.
  chmodSync(`${dir}/upstream.jsonl`, 0o666);
  const name = `erika-acceptance-${process.pid}-${label}`;
  const startedAt = performance.now();
  docker("run", "--detach", "--rm", "--name", name,
    "--publish", "127.0.0.1::8787", "--mount", `type=bind,source=${dir},target=/review`,
    "--env", "NODE_OPTIONS=--import=/review/upstream.mjs", ...env.flatMap(v => ["--env", v]), image);
  try {
    const origin = `http://127.0.0.1:${docker("port", name, "8787/tcp").split(":").at(-1)}`;
    let healthy = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(1000) })).ok) { healthy = true; break; } } catch {}
      await delay(100);
    }
    assert(healthy, `${label}: container did not start`);
    const startupMs = Math.round(performance.now() - startedAt);
    const request = async (path, options) => {
      const start = performance.now();
      const response = await fetch(origin + path, { signal: AbortSignal.timeout(30000), ...options });
      const bytes = Buffer.from(await response.arrayBuffer());
      const row = { status: response.status, ms: Math.round(performance.now() - start), bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"), headers: Object.fromEntries(response.headers) };
      if (response.headers.get("content-type")?.startsWith("image/")) writeFileSync(`${dir}/${row.sha256.slice(0, 12)}.webp`, bytes);
      return row;
    };
    await run({ origin, request, control, startupMs,
      health: async () => (await fetch(origin + "/healthz")).json(),
      calls: () => readFileSync(`${dir}/upstream.jsonl`, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
      memory: () => docker("stats", "--no-stream", "--format", "{{.MemUsage}}", name) });
  } finally {
    writeFileSync(`${dir}/container.log`, docker("logs", name));
    docker("stop", "--time", "1", name);
  }
}

try {
  for (const mode of ["timeout", "rate-limit"]) {
    await container(mode, ["ERIKA_FRESH_TTL_MS=100", "ERIKA_MAX_STALE_MS=10000", "ERIKA_TRANSIENT_TTL_MS=100"],
      async ({ request, control, startupMs, health, calls }) => {
        const path = "/v1/banner/Acceptance/Warm.webp?icon=builtin&meta=&theme=light";
        const baseline = await request(path);
        assert.equal(baseline.status, 200);
        control(mode);
        await delay(150);
        const stale = await request(path);
        assert.equal(stale.status, 200);
        assert.equal(stale.sha256, baseline.sha256, `${mode}: stale image changed`);
        assert.equal(stale.headers["x-banner-error"], undefined);
        const absent = await request(path.replace("/Warm.", "/Cold."));
        assert.equal(absent.status, 200);
        assert.equal(absent.headers["x-banner-error"], mode === "timeout" ? "upstream-timeout" : "upstream-rate-limited");
        assert.equal(absent.headers["cache-control"], "public, max-age=60, s-maxage=60");
        assert.equal(absent.headers["content-type"], "image/webp");
        assert(absent.bytes > 1000);
        control("ok", "Fixture recovered");
        await delay(mode === "timeout" ? 250 : 2200);
        await request(path);
        await delay(150);
        const recovered = await request(path);
        assert.equal(recovered.status, 200);
        assert.notEqual(recovered.sha256, baseline.sha256, `${mode}: recovery did not refresh image`);
        const stats = await health();
        assert.equal(stats.renderQueue, 0);
        report.faults.push({ mode, startupMs, baseline, stale, absent, recovered, health: stats, upstreamCalls: calls() });
        console.log(`Fault acceptance passed: ${mode}, stale, placeholder, recovery.`);
      });
  }
  await container("load", ["ERIKA_FRESH_TTL_MS=3600000", "ERIKA_RENDER_CACHE_MB=2"],
    async ({ request, startupMs, health, calls, memory }) => {
      const path = "/v1/banner/Acceptance/Load.webp?icon=builtin&meta=&theme=light";
      const initial = await request(path);
      report.cold = { startupMs, firstImage: initial, memory: memory() };
      assert.equal(initial.status, 200);
      const conditional = await request(path, { headers: { "If-None-Match": initial.headers.etag } });
      assert.equal(conditional.status, 304);
      for (const [label, count, concurrency, unique] of [["hot", 24, 4, false], ["new-images", 16, 4, true], ["burst", 80, 80, true]]) {
        const results = [];
        let next = 0;
        const before = await health();
        const start = performance.now();
        await Promise.all(Array.from({ length: concurrency }, async () => {
          while (next < count) {
            const i = next++;
            results.push(await request(path + (unique ? `&title=${label}-${i}` : "")));
          }
        }));
        const elapsedMs = Math.round(performance.now() - start);
        const timings = results.map(r => r.ms).sort((a, b) => a - b);
        const statuses = {};
        for (const result of results) {
          statuses[result.status] = (statuses[result.status] ?? 0) + 1;
          assert([200, 503].includes(result.status));
          if (result.status === 503) assert.equal(result.headers["retry-after"], "5");
        }
        if (label === "burst") assert((statuses[503] ?? 0) > 0, "burst did not exercise queue overflow");
        const after = await health();
        assert(after.cache.bytes <= 2 * 1024 * 1024, "render cache exceeds configured byte bound");
        assert.equal(after.renderQueue, 0);
        if (!unique) assert.equal(before.cache.count, after.cache.count, "hot request generated new cached images");
        report.load.push({ label, count, concurrency, elapsedMs, p50: timings[Math.ceil(count * .5) - 1],
          p95: timings[Math.ceil(count * .95) - 1], max: timings.at(-1), statuses, before, after, memory: memory(), results });
        console.log(`Load ${label}: ${JSON.stringify(report.load.at(-1), (key, value) => key === "results" ? undefined : value)}`);
      }
      report.upstreamCalls = calls();
      assert.equal(report.upstreamCalls.length, 1, "load test bypassed provider cache");
    });
  report.passed = true;
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`Acceptance report: ${output}/report.json`);
}

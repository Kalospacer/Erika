import { appendFileSync, readFileSync } from "node:fs";

// Used only by an isolated acceptance container via NODE_OPTIONS.
// The control file is mounted by the harness; production fetch stays unchanged.
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "api.github.com") return new Response("fixture resource missing", { status: 404 });
  const state = JSON.parse(readFileSync("/review/state.json", "utf8"));
  appendFileSync("/review/upstream.jsonl", JSON.stringify({ at: Date.now(), path: url.pathname, mode: state.mode }) + "\n");
  if (state.mode === "timeout") {
    return new Promise((_, reject) => {
      const signal = options.signal;
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }
  if (state.mode === "rate-limit") {
    return new Response("{}", { status: 429, headers: { "x-ratelimit-remaining": "0", "retry-after": "2" } });
  }
  if (url.pathname.endsWith("/releases/latest")) return new Response("{}", { status: 404 });
  const name = url.pathname.split("/").at(-1);
  return Response.json({
    full_name: `Acceptance/${name}`, name, description: state.description,
    private: false, default_branch: "main", stargazers_count: 42,
    forks_count: 3, open_issues_count: 2,
  }, { headers: { etag: `"${state.description}"` } });
};

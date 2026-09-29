import { readFileSync } from "node:fs";
import { join } from "node:path";

// Container smoke tests use real HTTP routes and rendering, with fixed upstream
// data. A wrong repo-icon URL must fail instead of being accepted by the fixture.
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "api.github.com") {
    if (url.pathname.toLowerCase().includes("/missing")) return new Response("{}", { status: 404 });
    if (url.pathname.endsWith("/releases/latest")) return Response.json({ tag_name: "v1.0.0" });
    return Response.json({
      full_name: "Moemu/Erika", name: "Erika",
      description: "A deterministic container smoke test", default_branch: "main",
      private: false, stargazers_count: 42, forks_count: 3, open_issues_count: 2,
    }, { headers: { etag: '"fixture-v1"' } });
  }
  // pinned exactly: the preset's declared path is part of the public contract,
  // so a wrong URL must fail instead of being accepted by the fixture
  if (url.href === "https://raw.githubusercontent.com/Moemu/Erika/main/assets/erika-icon.webp") {
    return new Response(readFileSync(join(process.env.ERIKA_TEMPLATES_DIR, "assets", "erika.webp")));
  }
  return new Response("fixture has no such resource", { status: 404 });
};

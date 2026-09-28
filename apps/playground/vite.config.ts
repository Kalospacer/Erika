import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Root-relative assets also load when the server falls back from a nested URL.
// A deployment under a subpath must build with Vite's --base option.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:8787",
      "/healthz": "http://localhost:8787",
    },
  },
});

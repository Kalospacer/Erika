import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" so the built dist works from any static path: API-container
// same-origin hosting, a subpath, or a static CDN (design doc section 10).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:8787",
      "/healthz": "http://localhost:8787",
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:3111" },
    // Caddy 経由（https://learn-english）の Host ヘッダを許可
    allowedHosts: ["learn-english", ".localhost"],
  },
});

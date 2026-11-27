import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // SUITESPOT_API_PORT: run the API on another port when 3000 is taken (the web port is set with --port).
    // xfwd: the API sees the browser's host (X-Forwarded-Host), so payment return links point back to this dev server
    proxy: { "/api": { target: `http://localhost:${process.env.SUITESPOT_API_PORT ?? 3000}`, changeOrigin: false, xfwd: true } },
  },
  build: { outDir: "dist", emptyOutDir: true },
})

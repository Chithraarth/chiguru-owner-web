import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// SPA navigation fallback: any hard load/reload of a client route (e.g. /workers)
// must resolve to the app shell, or the service worker serves nothing and the user
// hits the in-app "404 Page Not Found". Derived from base so it works under any prefix.
const baseNoSlash = basePath.replace(/\/$/, "");
const navigateFallback = `${baseNoSlash}/index.html`;
// API requests are built as `${BASE_URL}api/...`, so under a non-root base they are
// `${base}/api/...`. Match that so runtime caching + navigation denylist stay correct
// under any prefix, not just root.
const apiUrlPattern = new RegExp(
  `^${baseNoSlash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/api/`,
);

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback,
        navigateFallbackDenylist: [apiUrlPattern],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: apiUrlPattern,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Chiguru",
        short_name: "Chiguru",
        description: "Offline-first farm management for smallholder farmers",
        theme_color: "#231F3A",
        background_color: "#FAF9FD",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

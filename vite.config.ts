import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// Situs diterbitkan di https://<user>.github.io/farmasi-ugd/
const base = "/farmasi-ugd/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png", "favicon.ico"],
      manifest: {
        name: "e-Stok UGD — Puskesmas Liukang Tupabbiring",
        short_name: "e-Stok UGD",
        description: "Catatan stok obat dan bahan medis UGD Puskesmas Liukang Tupabbiring",
        lang: "id",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0a0f1a",
        theme_color: "#0a0f1a",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Aplikasi tetap terbuka tanpa sinyal; data disimpan oleh cache Firestore.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Library dipisah dari kode aplikasi agar tetap ter-cache saat aplikasi diperbarui
        codeSplitting: {
          groups: [
            { name: "firebase", test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});

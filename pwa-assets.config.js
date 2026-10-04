import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Membuat ikon PWA (PNG) dari public/favicon.svg: npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#00d4aa" } },
  },
  images: ["public/favicon.svg"],
});

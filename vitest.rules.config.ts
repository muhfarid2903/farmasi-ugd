import { defineConfig } from "vitest/config";

// Tes aturan keamanan dijalankan terpisah karena butuh emulator Firestore.
export default defineConfig({
  test: {
    include: ["rules-tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});

/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Solo nei test: risolve @gym-tracker/shared dal sorgente TS invece che
    // dal dist compilato, cosi' `vitest run` funziona anche da checkout
    // pulito (in CI i test girano prima del build). Dev/build usano invece
    // la risoluzione reale via node_modules (richiede shared prebuilt).
    alias: {
      "@gym-tracker/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url)
      ),
    },
  },
});

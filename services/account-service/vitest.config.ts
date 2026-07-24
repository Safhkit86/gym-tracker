import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * I test risolvono @gym-tracker/shared direttamente dal sorgente TS, non dal
 * dist compilato: cosi' `vitest run` funziona anche da checkout pulito (es. in
 * CI, dove i test girano prima del build) senza dipendere dall'ordine di build.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@gym-tracker/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url)
      ),
    },
  },
});

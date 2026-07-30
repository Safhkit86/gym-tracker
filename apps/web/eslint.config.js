import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(js.configs.recommended, tseslint.configs.recommended, {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { ...globals.browser, ...globals.es2022 },
  },
  plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
  rules: {
    // Solo le due regole classiche (non l'intero preset "recommended" di
    // react-hooks v7, che include anche la nuova famiglia di regole del
    // React Compiler -- fuori scope per un aggiornamento pensato solo a
    // risolvere una CVE di eslint, avrebbe richiesto di riscrivere pattern
    // gia' funzionanti nel codice esistente).
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
});

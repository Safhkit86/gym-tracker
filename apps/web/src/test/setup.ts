import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// @testing-library/jest-dom e' hoisted nel node_modules di root (condiviso
// col vitest@2 dei servizi backend): il suo entry point "/vitest" chiamerebbe
// expect.extend usando QUEL vitest, non il vitest@4 nested di questo
// workspace (quello che esegue davvero questi test). Importando `expect` qui
// (risolto correttamente contro il vitest locale) ed estendendolo a mano,
// i matcher finiscono sull'istanza giusta. Vedi anche test/jest-dom.d.ts.
expect.extend(matchers);

// L'auto-cleanup di @testing-library/react si registra solo se rileva un
// `afterEach` globale; qui non usiamo `test.globals` (import espliciti come
// nel backend), quindi va registrato a mano, altrimenti il DOM di un test
// resta montato nel successivo e le query falliscono per elementi duplicati
// appena un file di test ha piu' di un `it`.
afterEach(() => {
  cleanup();
});

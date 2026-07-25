import { afterEach, beforeEach, expect, vi } from "vitest";
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

// jsdom non implementa Web Audio: stub minimo globale cosi' il timer di
// recupero (utils/alarm-sound.ts) non lanci un ReferenceError in nessun
// test che arriva a far scattare l'allarme, senza doverlo ristubbare in
// ogni singolo file di test. In un beforeEach (non a livello di modulo):
// molti file di test chiamano vi.unstubAllGlobals() nel proprio afterEach,
// il che cancellerebbe uno stub registrato una sola volta al caricamento.
class FakeAudioContext {
  state: "running" | "suspended" = "running";
  currentTime = 0;
  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: { value: 0 },
      type: "sine" as const,
    };
  }
  createGain() {
    return {
      connect: () => {},
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    };
  }
  resume() {
    return Promise.resolve();
  }
}
beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

import { describe, it, expect } from "vitest";
import { evaluateProgression } from "../src/domain/progression-rule-engine.js";
import type { ExerciseSessionSnapshot } from "../src/repositories/exercise-history-cache-repository.js";

function session(
  sessionId: string,
  performedAt: string,
  sets: Array<{
    setNumber: number;
    targetMinReps: number | null;
    targetMaxReps?: number | null;
    actualReps: number;
    actualWeight: number | null;
  }>
): ExerciseSessionSnapshot {
  return {
    sessionId,
    performedAt,
    sets: sets.map((s) => ({ ...s, targetMaxReps: s.targetMaxReps ?? null })),
  };
}

const QUALIFYING_WEIGHTED = [
  { setNumber: 1, targetMinReps: 10, actualReps: 10, actualWeight: 80 },
  { setNumber: 2, targetMinReps: 10, actualReps: 12, actualWeight: 80 },
];

const QUALIFYING_BODYWEIGHT = [
  { setNumber: 1, targetMinReps: 8, actualReps: 9, actualWeight: null },
  { setNumber: 2, targetMinReps: 8, actualReps: 8, actualWeight: null },
];

describe("evaluateProgression", () => {
  it("suggerisce increase_weight dopo 2 sessioni consecutive qualificanti allo stesso peso", () => {
    const history = [
      session("s2", "2026-07-10", QUALIFYING_WEIGHTED),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    const result = evaluateProgression(history, 2.5);
    expect(result).toMatchObject({
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
    });
  });

  it("suggerisce increase_reps per un esercizio a corpo libero", () => {
    const history = [
      session("s2", "2026-07-10", QUALIFYING_BODYWEIGHT),
      session("s1", "2026-07-03", QUALIFYING_BODYWEIGHT),
    ];
    const result = evaluateProgression(history, 1);
    expect(result).toMatchObject({
      suggestionType: "increase_reps",
      previousValue: 8,
      suggestedValue: 9,
    });
  });

  it("non propone nulla se progressionIncrement non e' configurato", () => {
    const history = [
      session("s2", "2026-07-10", QUALIFYING_WEIGHTED),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    expect(evaluateProgression(history, null)).toBeNull();
  });

  it("non propone nulla con una sola sessione storica", () => {
    const history = [session("s1", "2026-07-10", QUALIFYING_WEIGHTED)];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("non propone nulla se il peso non e' uniforme tra i set di una sessione", () => {
    const nonUniform = [
      { setNumber: 1, targetMinReps: 10, actualReps: 10, actualWeight: 80 },
      { setNumber: 2, targetMinReps: 10, actualReps: 10, actualWeight: 82.5 },
    ];
    const history = [
      session("s2", "2026-07-10", nonUniform),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("non propone nulla se il peso cambia tra le due sessioni", () => {
    const heavier = QUALIFYING_WEIGHTED.map((s) => ({ ...s, actualWeight: 82.5 }));
    const history = [
      session("s2", "2026-07-10", heavier),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("non propone nulla se il numero di set qualificanti non coincide tra le sessioni", () => {
    const history = [
      session("s2", "2026-07-10", [
        ...QUALIFYING_WEIGHTED,
        { setNumber: 3, targetMinReps: 10, actualReps: 10, actualWeight: 80 },
      ]),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("non propone nulla se un set non ha raggiunto l'obiettivo di ripetizioni", () => {
    const shortfall = [
      { setNumber: 1, targetMinReps: 10, actualReps: 8, actualWeight: 80 },
      { setNumber: 2, targetMinReps: 10, actualReps: 10, actualWeight: 80 },
    ];
    const history = [
      session("s2", "2026-07-10", shortfall),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("non propone nulla se nessun set ha un obiettivo di ripetizioni (log libero)", () => {
    const freeform = [{ setNumber: 1, targetMinReps: null, actualReps: 10, actualWeight: 80 }];
    const history = [session("s2", "2026-07-10", freeform), session("s1", "2026-07-03", freeform)];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("con un range, suggerisce solo se si raggiungono le rep massime (non basta il minimo)", () => {
    const onlyMinimumMet = [
      { setNumber: 1, targetMinReps: 8, targetMaxReps: 12, actualReps: 8, actualWeight: 80 },
      { setNumber: 2, targetMinReps: 8, targetMaxReps: 12, actualReps: 8, actualWeight: 80 },
    ];
    const history = [
      session("s2", "2026-07-10", onlyMinimumMet),
      session("s1", "2026-07-03", onlyMinimumMet),
    ];
    expect(evaluateProgression(history, 2.5)).toBeNull();
  });

  it("con un range, suggerisce increase_weight quando si raggiungono le rep massime", () => {
    const maxMet = [
      { setNumber: 1, targetMinReps: 8, targetMaxReps: 12, actualReps: 12, actualWeight: 80 },
      { setNumber: 2, targetMinReps: 8, targetMaxReps: 12, actualReps: 12, actualWeight: 80 },
    ];
    const history = [session("s2", "2026-07-10", maxMet), session("s1", "2026-07-03", maxMet)];
    const result = evaluateProgression(history, 2.5);
    expect(result).toMatchObject({
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
    });
  });

  it("con requiredConsecutiveSessions personalizzato, non basta il numero di default", () => {
    const history = [
      session("s2", "2026-07-10", QUALIFYING_WEIGHTED),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    // Preferenza utente: servono 3 sessioni consecutive, non le 2 di default.
    expect(evaluateProgression(history, 2.5, 3)).toBeNull();
  });

  it("con requiredConsecutiveSessions personalizzato a 3, suggerisce dopo 3 sessioni consecutive", () => {
    const history = [
      session("s3", "2026-07-17", QUALIFYING_WEIGHTED),
      session("s2", "2026-07-10", QUALIFYING_WEIGHTED),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    const result = evaluateProgression(history, 2.5, 3);
    expect(result).toMatchObject({
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
    });
  });

  it("con requiredConsecutiveSessions=1, basta una sola sessione qualificante", () => {
    const history = [session("s1", "2026-07-10", QUALIFYING_WEIGHTED)];
    const result = evaluateProgression(history, 2.5, 1);
    expect(result).toMatchObject({
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
    });
  });

  it("con requiredConsecutiveSessions=3, non propone nulla se una delle 3 sessioni non e' uniforme", () => {
    const heavier = QUALIFYING_WEIGHTED.map((s) => ({ ...s, actualWeight: 82.5 }));
    const history = [
      session("s3", "2026-07-17", heavier),
      session("s2", "2026-07-10", QUALIFYING_WEIGHTED),
      session("s1", "2026-07-03", QUALIFYING_WEIGHTED),
    ];
    expect(evaluateProgression(history, 2.5, 3)).toBeNull();
  });

  it("suggerisce anche se la sessione precedente non ha un obiettivo storicizzato (scheda configurata dopo)", () => {
    // La sessione precedente e' stata registrata prima che l'esercizio avesse
    // un obiettivo di ripetizioni configurato sulla scheda (targetMinReps
    // null su tutti i set, come nello storico pre-esistente reale): le sue
    // ripetizioni effettive vanno comunque confrontate con l'obiettivo
    // ATTUALE (quello della sessione di oggi), non scartate.
    const noTargetYet = [
      { setNumber: 1, targetMinReps: null, actualReps: 12, actualWeight: 20 },
      { setNumber: 2, targetMinReps: null, actualReps: 12, actualWeight: 20 },
    ];
    const withTarget = [
      { setNumber: 1, targetMinReps: 8, targetMaxReps: 12, actualReps: 12, actualWeight: 20 },
      { setNumber: 2, targetMinReps: 8, targetMaxReps: 12, actualReps: 12, actualWeight: 20 },
    ];
    const history = [
      session("s2", "2026-07-20", withTarget),
      session("s1", "2026-07-13", noTargetYet),
    ];
    const result = evaluateProgression(history, 2);
    expect(result).toMatchObject({
      suggestionType: "increase_weight",
      previousValue: 20,
      suggestedValue: 22,
    });
  });

  describe("confronto del numero di set con l'ultima sessione precedente", () => {
    const withTarget = (
      actualReps: number,
      count: number
    ): Array<{
      setNumber: number;
      targetMinReps: number;
      targetMaxReps: number;
      actualReps: number;
      actualWeight: number;
    }> =>
      Array.from({ length: count }, (_, i) => ({
        setNumber: i + 1,
        targetMinReps: 8,
        targetMaxReps: 12,
        actualReps,
        actualWeight: 20,
      }));

    it("Es.1: finestra di 2, oggi con meno serie della precedente (4 -> 3): scatta", () => {
      const history = [
        session("oggi", "2026-07-27", withTarget(12, 3)),
        session("prec", "2026-07-20", withTarget(12, 4)),
      ];
      expect(evaluateProgression(history, 2)).toMatchObject({ suggestionType: "increase_weight" });
    });

    it("Es.3: finestra di 2, oggi con piu' serie della precedente (3 -> 4): non scatta", () => {
      const history = [
        session("oggi", "2026-07-27", withTarget(12, 4)),
        session("prec", "2026-07-20", withTarget(12, 3)),
      ];
      expect(evaluateProgression(history, 2)).toBeNull();
    });

    it("Es.2: finestra di 3 (penultima=3, ultima=4 serie), oggi con 3 o 4 serie: scatta in entrambi i casi", () => {
      // history va ordinata dalla piu' recente alla meno recente: ultima
      // (piu' recente) prima di penultima (piu' vecchia).
      const olderHistory = [
        session("ultima", "2026-07-20", withTarget(12, 4)),
        session("penultima", "2026-07-13", withTarget(12, 3)),
      ];
      const history3 = [session("oggi", "2026-07-27", withTarget(12, 3)), ...olderHistory];
      const history4 = [session("oggi", "2026-07-27", withTarget(12, 4)), ...olderHistory];
      expect(evaluateProgression(history3, 2, 3)).toMatchObject({
        suggestionType: "increase_weight",
      });
      expect(evaluateProgression(history4, 2, 3)).toMatchObject({
        suggestionType: "increase_weight",
      });
    });

    it("Es.4: finestra di 3 (penultima=4, ultima=3 serie), oggi con 3 serie scatta ma con 4 no", () => {
      const olderHistory = [
        session("ultima", "2026-07-20", withTarget(12, 3)),
        session("penultima", "2026-07-13", withTarget(12, 4)),
      ];
      const history3 = [session("oggi", "2026-07-27", withTarget(12, 3)), ...olderHistory];
      const history4 = [session("oggi", "2026-07-27", withTarget(12, 4)), ...olderHistory];
      expect(evaluateProgression(history3, 2, 3)).toMatchObject({
        suggestionType: "increase_weight",
      });
      expect(evaluateProgression(history4, 2, 3)).toBeNull();
    });
  });
});

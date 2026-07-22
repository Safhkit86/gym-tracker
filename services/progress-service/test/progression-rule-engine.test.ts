import { describe, it, expect } from "vitest";
import { evaluateProgression } from "../src/domain/progression-rule-engine.js";
import type { ExerciseSessionSnapshot } from "../src/repositories/session-repository.js";

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
});

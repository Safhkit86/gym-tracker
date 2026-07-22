import type { ExerciseSessionSnapshot } from "../repositories/session-repository.js";

/**
 * Numero di sessioni consecutive che devono soddisfare l'obiettivo di
 * ripetizioni prima che scatti un suggerimento. Scelta deliberata (non
 * configurabile in v1): 1 sola sessione produrrebbe suggerimenti "rumorosi"
 * su una singola buona prestazione, invece di una tendenza reale.
 */
export const REQUIRED_CONSECUTIVE_SESSIONS = 2;

export interface ProgressionSuggestionResult {
  suggestionType: "increase_weight" | "increase_reps";
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
}

/**
 * Regola v1 -- decide solo il *quando*, mai il *quanto*: l'incremento e'
 * sempre quello configurato dall'utente sull'esercizio nella scheda
 * (WorkoutExercise.progressionIncrement). Se non configurato (`null`), non
 * viene mai proposto nulla (fail-closed: "manuale" significa che l'utente ha
 * gia' deciso il quanto, il motore decide solo se e' il momento).
 *
 * `history` deve essere ordinata dalla sessione piu' recente alla meno
 * recente e gia' filtrata per (owner, scheda, esercizio) -- vedi
 * SessionRepository.findRecentSetsForExercise.
 */
export function evaluateProgression(
  history: ExerciseSessionSnapshot[],
  progressionIncrement: number | null
): ProgressionSuggestionResult | null {
  if (progressionIncrement === null) {
    return null;
  }
  if (history.length < REQUIRED_CONSECUTIVE_SESSIONS) {
    return null;
  }

  const recent = history.slice(0, REQUIRED_CONSECUTIVE_SESSIONS);
  const perSession: Array<{ weight: number | null; count: number; minReps: number }> = [];

  for (const session of recent) {
    const qualifying = session.sets.filter((s) => s.targetMinReps !== null);
    if (qualifying.length === 0) {
      return null; // niente obiettivo da valutare in questa sessione
    }
    // L'obiettivo effettivo e' il massimo se e' stato impostato un range,
    // altrimenti il minimo (che e' l'unico valore prescritto).
    const metAll = qualifying.every((s) => {
      const effectiveTarget = s.targetMaxReps ?? (s.targetMinReps as number);
      return s.actualReps >= effectiveTarget;
    });
    if (!metAll) {
      return null;
    }
    // Il peso deve essere uniforme tra i set qualificanti della sessione:
    // drop-set/schemi piramidali non sono gestiti in v1, si rinuncia invece
    // di indovinare quale peso rappresenti "il" peso di lavoro.
    const weights = new Set(qualifying.map((s) => s.actualWeight));
    if (weights.size !== 1) {
      return null;
    }
    perSession.push({
      weight: [...weights][0] ?? null,
      count: qualifying.length,
      minReps: Math.min(...qualifying.map((s) => s.actualReps)),
    });
  }

  const [latest, previous] = perSession as [
    (typeof perSession)[number],
    (typeof perSession)[number],
  ];
  if (latest.count !== previous.count || latest.weight !== previous.weight) {
    return null;
  }

  if (latest.weight !== null) {
    return {
      suggestionType: "increase_weight",
      previousValue: latest.weight,
      suggestedValue: latest.weight + progressionIncrement,
      reason: `Obiettivo di ripetizioni raggiunto per ${REQUIRED_CONSECUTIVE_SESSIONS} sessioni consecutive a ${latest.weight}kg: aumenta il carico.`,
    };
  }

  // A corpo libero: si progredisce sulle ripetizioni, non sul peso.
  return {
    suggestionType: "increase_reps",
    previousValue: latest.minReps,
    suggestedValue: Math.round(latest.minReps + progressionIncrement),
    reason: `Obiettivo di ripetizioni raggiunto per ${REQUIRED_CONSECUTIVE_SESSIONS} sessioni consecutive a corpo libero: aumenta le ripetizioni.`,
  };
}

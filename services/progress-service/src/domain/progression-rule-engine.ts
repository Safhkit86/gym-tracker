import type { ExerciseSessionSnapshot, HistoricalSet } from "../repositories/session-repository.js";

/**
 * Numero di default di sessioni consecutive che devono soddisfare
 * l'obiettivo di ripetizioni prima che scatti un suggerimento (1 sola
 * sessione produrrebbe suggerimenti "rumorosi" su una singola buona
 * prestazione, invece di una tendenza reale). Configurabile per utente
 * (Profilo > Preferenze, vedi progression-preferences-repository.ts):
 * questo e' solo il valore di default per chi non ha ancora impostato nulla.
 */
export const REQUIRED_CONSECUTIVE_SESSIONS = 2;

export interface ProgressionSuggestionResult {
  suggestionType: "increase_weight" | "increase_reps";
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
}

/**
 * Set "qualificanti" di una sessione: quelli con un obiettivo di ripetizioni
 * prescritto (esclude i set a sforzo massimo/AMRAP, che non ne hanno). Le
 * sessioni registrate prima che un esercizio avesse un obiettivo configurato
 * hanno pero' l'obiettivo `null` su TUTTI i set, non solo su un eventuale
 * AMRAP: senza un modo per distinguere i due casi, in quella situazione si
 * ripiega su tutti i set registrati, cosi' da non escludere per sempre le
 * sessioni precedenti alla configurazione dell'obiettivo.
 */
function qualifyingSets(session: ExerciseSessionSnapshot): HistoricalSet[] {
  const withTarget = session.sets.filter((s) => s.targetMinReps !== null);
  return withTarget.length > 0 ? withTarget : session.sets;
}

interface SessionOutcome {
  weight: number | null;
  count: number;
}

/** Una sessione (di oggi o storica) soddisfa `effectiveTarget` se tutti i
 *  suoi set qualificanti lo raggiungono con un peso uniforme tra di essi. */
function evaluateSession(
  session: ExerciseSessionSnapshot,
  effectiveTarget: number
): SessionOutcome | null {
  const sets = qualifyingSets(session);
  if (sets.length === 0) {
    return null;
  }
  const metAll = sets.every((s) => s.actualReps >= effectiveTarget);
  if (!metAll) {
    return null;
  }
  // Il peso deve essere uniforme tra i set qualificanti della sessione:
  // drop-set/schemi piramidali non sono gestiti in v1, si rinuncia invece
  // di indovinare quale peso rappresenti "il" peso di lavoro.
  const weights = new Set(sets.map((s) => s.actualWeight));
  if (weights.size !== 1) {
    return null;
  }
  return { weight: [...weights][0] ?? null, count: sets.length };
}

/**
 * Regola v1 -- decide solo il *quando*, mai il *quanto*: l'incremento e'
 * sempre quello configurato dall'utente sull'esercizio nella scheda
 * (WorkoutExercise.progressionIncrement). Se non configurato (`null`), non
 * viene mai proposto nulla (fail-closed: "manuale" significa che l'utente ha
 * gia' deciso il quanto, il motore decide solo se e' il momento).
 *
 * L'obiettivo di ripetizioni contro cui si giudicano TUTTE le sessioni della
 * finestra (oggi + le `requiredConsecutiveSessions - 1` precedenti) e'
 * sempre quello ATTUALE della scheda, preso dallo snapshot della sessione
 * appena registrata (che lo riflette gia', essendo stato fotografato ora) --
 * MAI dallo snapshot delle sessioni piu' vecchie: quello serve solo a
 * mostrare lo Storico com'era quel giorno (vedi CLAUDE.md), non e' la
 * definizione dell'obiettivo con cui valutare, che puo' essere cambiata nel
 * frattempo o non essere mai esistita quando quelle sessioni furono
 * registrate.
 *
 * Il numero di set qualificanti puo' calare nel tempo (la scheda puo'
 * essere stata alleggerita) senza bloccare il suggerimento, ma mai
 * aumentare rispetto all'ultima sessione precedente: se oggi se ne fanno di
 * piu', le sessioni piu' vecchie non dimostrano che il volume odierno fosse
 * gia' alla portata. Questo confronto riguarda solo la sessione
 * immediatamente precedente, non l'intera finestra.
 *
 * `history` deve essere ordinata dalla sessione piu' recente alla meno
 * recente, includere la sessione appena registrata come prima voce, ed
 * essere gia' filtrata per (owner, scheda, esercizio) -- vedi
 * SessionRepository.findRecentSetsForExercise.
 */
export function evaluateProgression(
  history: ExerciseSessionSnapshot[],
  progressionIncrement: number | null,
  requiredConsecutiveSessions: number = REQUIRED_CONSECUTIVE_SESSIONS
): ProgressionSuggestionResult | null {
  if (progressionIncrement === null) {
    return null;
  }
  if (history.length < requiredConsecutiveSessions) {
    return null;
  }

  const [today, ...previousSessions] = history.slice(0, requiredConsecutiveSessions) as [
    ExerciseSessionSnapshot,
    ...ExerciseSessionSnapshot[],
  ];

  const todayQualifying = qualifyingSets(today);
  const [firstQualifying] = todayQualifying;
  if (!firstQualifying) {
    return null; // niente obiettivo da valutare oggi
  }
  const effectiveTarget = firstQualifying.targetMaxReps ?? firstQualifying.targetMinReps;
  if (effectiveTarget === null) {
    return null;
  }

  const todayOutcome = evaluateSession(today, effectiveTarget);
  if (!todayOutcome) {
    return null;
  }

  const previousOutcomes: SessionOutcome[] = [];
  for (const session of previousSessions) {
    const outcome = evaluateSession(session, effectiveTarget);
    if (!outcome) {
      return null;
    }
    previousOutcomes.push(outcome);
  }

  // Il peso deve restare identico su tutta la finestra (oggi + storico).
  const allSameWeight = previousOutcomes.every((o) => o.weight === todayOutcome.weight);
  if (!allSameWeight) {
    return null;
  }

  // Il volume di oggi non puo' superare quello dell'ultima sessione
  // precedente (vedi commento sopra la funzione).
  const immediatePrevious = previousOutcomes[0];
  if (immediatePrevious && immediatePrevious.count < todayOutcome.count) {
    return null;
  }

  if (todayOutcome.weight !== null) {
    return {
      suggestionType: "increase_weight",
      previousValue: todayOutcome.weight,
      suggestedValue: todayOutcome.weight + progressionIncrement,
      reason: `Obiettivo di ripetizioni raggiunto per ${requiredConsecutiveSessions} sessioni consecutive a ${todayOutcome.weight}kg: aumenta il carico.`,
    };
  }

  // A corpo libero: si progredisce sulle ripetizioni, non sul peso.
  const minReps = Math.min(...todayQualifying.map((s) => s.actualReps));
  return {
    suggestionType: "increase_reps",
    previousValue: minReps,
    suggestedValue: Math.round(minReps + progressionIncrement),
    reason: `Obiettivo di ripetizioni raggiunto per ${requiredConsecutiveSessions} sessioni consecutive a corpo libero: aumenta le ripetizioni.`,
  };
}

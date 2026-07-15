/**
 * Contratti di progress-service: storico delle sessioni eseguite (esecuzione
 * reale contro la prescrizione di workout-service) e suggerimenti del motore
 * di progressione. Il client possiede gia' tutti i dati della scheda quando
 * registra una sessione (li ha appena caricati per mostrarla), quindi invia
 * uno snapshot autosufficiente: progress-service non chiama mai
 * workout-service via HTTP.
 */

// --- Input (body di POST /sessions) ---

export interface SessionSetInput {
  setNumber: number;
  /** Snapshot della prescrizione al momento del log; null per log liberi. */
  targetReps?: number | null;
  actualReps: number;
  /** kg; null = a corpo libero. */
  actualWeight?: number | null;
  /** Percezione dello sforzo 1-10; null se non registrata. */
  actualRpe?: number | null;
}

export interface SessionExerciseInput {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId?: string | null;
  /** Snapshot di WorkoutExercise.progressionIncrement al momento del log. */
  progressionIncrement?: number | null;
  sets: SessionSetInput[];
}

export interface SessionInput {
  workoutId: string;
  workoutName: string;
  performedAt: string;
  notes?: string | null;
  exercises: SessionExerciseInput[];
}

// --- Output ---

export interface SessionSet {
  id: string;
  setNumber: number;
  targetReps: number | null;
  actualReps: number;
  actualWeight: number | null;
  actualRpe: number | null;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string | null;
  progressionIncrement: number | null;
  sets: SessionSet[];
}

/** Vista sintetica per lo storico. */
export interface SessionSummary {
  id: string;
  workoutId: string;
  workoutName: string;
  performedAt: string;
  exerciseCount: number;
  createdAt: string;
}

/** Vista completa: sessione con esercizi e set eseguiti. */
export interface SessionDetail {
  id: string;
  workoutId: string;
  workoutName: string;
  performedAt: string;
  notes: string | null;
  exercises: SessionExercise[];
  createdAt: string;
}

export type ProgressionSuggestionType = "increase_weight" | "increase_reps";

/**
 * Suggerimento emesso dal motore di regole quando lo storico soddisfa la
 * condizione di progressione. `source` e' l'aggancio per una futura fonte
 * "ai" (analisi statistica dello storico che propone essa stessa il valore);
 * in questa fase e' sempre "rule" (regola fissa, incremento configurato
 * dall'utente sulla scheda).
 */
export interface ProgressionEvent {
  id: string;
  exerciseId: string;
  exerciseName: string;
  triggeringSessionId: string;
  suggestionType: ProgressionSuggestionType;
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
  source: "rule" | "ai";
  createdAt: string;
}

/** Risposta di POST /sessions: la sessione creata + eventuali suggerimenti. */
export interface CreateSessionResponse extends SessionDetail {
  suggestions: ProgressionEvent[];
}

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
  targetMinReps?: number | null;
  /** Snapshot della prescrizione al momento del log; null se non era un range. */
  targetMaxReps?: number | null;
  actualReps: number;
  /** kg; null = a corpo libero. */
  actualWeight?: number | null;
  /** Percezione dello sforzo 1-10; null se non registrata. */
  actualRpe?: number | null;
  /** Snapshot di WorkoutSet.restMinSeconds (recupero tra questo set e il
   *  successivo dello stesso esercizio) al momento del log. */
  targetRestMinSeconds?: number | null;
  /** Snapshot di WorkoutSet.restMaxSeconds al momento del log. */
  targetRestMaxSeconds?: number | null;
  /** Recupero tra i set effettivamente preso. */
  actualRestSeconds?: number | null;
}

export interface SessionExerciseInput {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId?: string | null;
  /** Snapshot di WorkoutExercise.progressionIncrement al momento del log. */
  progressionIncrement?: number | null;
  /** Snapshot di WorkoutExercise.restSeconds (recupero prima di passare
   *  all'esercizio successivo — concetto diverso dal recupero tra i set,
   *  che vive sul singolo set) al momento del log. */
  restSeconds?: number | null;
  sets: SessionSetInput[];
}

export interface SessionInput {
  workoutId: string;
  workoutName: string;
  /** Snapshot di Workout.notes al momento del log (non le note della sessione). */
  workoutNotes?: string | null;
  performedAt: string;
  notes?: string | null;
  exercises: SessionExerciseInput[];
}

// --- Output ---

export interface SessionSet {
  id: string;
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  actualReps: number;
  actualWeight: number | null;
  actualRpe: number | null;
  /** Snapshot di WorkoutSet.restMinSeconds al momento del log. */
  targetRestMinSeconds: number | null;
  /** Snapshot di WorkoutSet.restMaxSeconds al momento del log. */
  targetRestMaxSeconds: number | null;
  /** Recupero tra i set effettivamente preso. */
  actualRestSeconds: number | null;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string | null;
  progressionIncrement: number | null;
  /** Snapshot di WorkoutExercise.restSeconds (recupero prima dell'esercizio
   *  successivo) al momento del log. */
  restSeconds: number | null;
  sets: SessionSet[];
}

/** Vista completa: sessione con esercizi e set eseguiti. */
export interface SessionDetail {
  id: string;
  workoutId: string;
  workoutName: string;
  /** Snapshot di Workout.notes al momento del log (non le note della sessione). */
  workoutNotes: string | null;
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

/**
 * Payload pubblicato su RabbitMQ (coda "progression-events"): include
 * `ownerId`, assente dal DTO di GET /progression perche' li' il chiamante e'
 * gia' autenticato come proprietario. notify-service (Fase 4) lo usa per
 * sapere a chi appartiene la notifica.
 */
export interface ProgressionEventMessage extends ProgressionEvent {
  ownerId: string;
}

/**
 * Nome della coda RabbitMQ su cui progress-service pubblica e notify-service
 * consuma: vive qui (non in un solo servizio) perche' e' un contratto tra i
 * due, non un dettaglio implementativo di uno solo.
 */
export const PROGRESSION_EVENTS_QUEUE = "progression-events";

import type { ColumnType, Generated } from "kysely";

/**
 * Tipi delle tabelle per Kysely (unica fonte di verita' lato tipi). Le
 * migrazioni SQL in ./migrations devono restare allineate a queste interfacce.
 *
 * Nota: le colonne `numeric` (progression_increment, actual_weight,
 * previous_value, suggested_value) tornano da node-pg come stringa, quindi in
 * select sono `string | null`; in insert/update accettiamo `number | null`
 * (stesso trattamento di target_weight in workout-service).
 */
export interface WorkoutSessionsTable {
  id: Generated<string>;
  owner_id: string;
  /** Non FK: workout-service e' un altro servizio (stesso DB fisico). */
  workout_id: string;
  /** Denormalizzato dal client al momento del log (evita una chiamata HTTP). */
  workout_name: string;
  /** Snapshot di Workout.notes al momento del log (non le note della sessione). */
  workout_notes: string | null;
  performed_at: ColumnType<Date, Date | string, Date | string>;
  notes: string | null;
  created_at: Generated<Date>;
}

export interface SessionSetsTable {
  id: Generated<string>;
  session_id: string;
  /** Non FK: catalogo esercizi vive in workout-service. */
  exercise_id: string;
  exercise_name: string;
  workout_exercise_id: string | null;
  set_number: number;
  /** Snapshot della prescrizione al momento del log; null per log liberi. */
  target_min_reps: number | null;
  /** Snapshot della prescrizione al momento del log; null se non era un range. */
  target_max_reps: number | null;
  /** Snapshot di WorkoutExercise.progressionIncrement al momento del log. */
  progression_increment: ColumnType<string | null, number | null, number | null>;
  /** Snapshot di WorkoutExercise.restSeconds al momento del log. */
  rest_seconds: number | null;
  /** Recupero effettivamente preso, inserito dall'utente nel form di log. */
  actual_rest_seconds: number | null;
  /** Indice dell'esercizio nell'array `exercises` della request: determina
   *  l'ordine di visualizzazione, non derivabile in modo affidabile da
   *  created_at quando piu' esercizi vengono inseriti nella stessa transazione. */
  position: number;
  actual_reps: number;
  actual_weight: ColumnType<string | null, number | null, number | null>;
  actual_rpe: number | null;
  created_at: Generated<Date>;
}

export interface ProgressionEventsTable {
  id: Generated<string>;
  owner_id: string;
  exercise_id: string;
  exercise_name: string;
  triggering_session_id: string;
  /** "increase_weight" | "increase_reps" */
  suggestion_type: string;
  previous_value: ColumnType<string | null, number | null, number | null>;
  suggested_value: ColumnType<string | null, number | null, number | null>;
  reason: string;
  /** "rule" (oggi) | "ai" (aggancio futuro, non usato ora). */
  source: string;
  created_at: Generated<Date>;
}

export interface Database {
  workout_sessions: WorkoutSessionsTable;
  session_sets: SessionSetsTable;
  progression_events: ProgressionEventsTable;
}

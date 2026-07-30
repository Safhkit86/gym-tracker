import type { ColumnType, Generated } from "kysely";

/**
 * Tipi delle tabelle per Kysely (unica fonte di verita' lato tipi). Le
 * migrazioni SQL in ./migrations devono restare allineate a queste interfacce.
 *
 * `workout_sessions`/`session_sets` non vivono piu' qui: sono state spostate
 * (logicamente, non fisicamente: vedi history-service/src/db/migrate.ts) in
 * history-service. `progression_events.triggering_session_id` e' quindi
 * logico, non FK (era l'unica FK reale del sistema finche' le due tabelle
 * vivevano nello stesso servizio: vedi migrazione 013).
 *
 * Nota: le colonne `numeric` (previous_value, suggested_value) tornano da
 * node-pg come stringa, quindi in select sono `string | null`; in
 * insert/update accettiamo `number | null`.
 */
export interface ProgressionEventsTable {
  id: Generated<string>;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  /** Logico, non FK: vedi commento sopra. */
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

export type GroupingScope = "workout" | "exercise";

export interface ProgressionPreferencesTable {
  user_id: string;
  required_consecutive_sessions: Generated<number>;
  grouping_scope: Generated<GroupingScope>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

/** "increase_weight" | "increase_reps", come ProgressionEventsTable.suggestion_type. */
export interface ProgressionDefaultsTable {
  user_id: string;
  exercise_id: string;
  suggestion_type: string;
  value: ColumnType<string, number, number>;
  created_at: Generated<Date>;
}

/**
 * Read-model alimentato consumando `session-logged` (history-service): evita
 * a progress-service di leggere le tabelle di un altro servizio per valutare
 * il motore di regole e per "esercizio in stallo". `recent_outcomes` e' una
 * finestra scorrevole (JSON stringificato, non jsonb: qui non serve mai
 * interrogare dentro il campo lato SQL, solo leggerlo/scriverlo per intero)
 * delle ultime sessioni per quell'esercizio, gia' nella forma richiesta dal
 * motore di regole (vedi progression-rule-engine.ts). `first_logged_at` non
 * viene mai spostato in avanti (solo `LEAST` su un evento piu' vecchio in
 * arrivo in seguito), cosi' da restare fedele al comportamento storico basato
 * su MIN(performed_at).
 */
export interface ExerciseHistoryCacheTable {
  user_id: string;
  exercise_id: string;
  /** Snapshot dell'ultimo nome esercizio visto (session-logged): puo'
   *  invecchiare se l'utente rinomina un esercizio custom, stesso
   *  trattamento gia' accettato per session_sets.exercise_name. */
  exercise_name: string;
  first_logged_at: ColumnType<Date, Date | string, Date | string>;
  recent_outcomes: string;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

/**
 * Marcatore scritto dal consumer di `session-logged` a valutazione completata:
 * supporta il polling di GET /sessions/:id/status (breve finestra dopo POST
 * /sessions in history-service, per continuare a mostrare subito l'eventuale
 * suggerimento com'era quando le due responsabilita' erano nello stesso
 * servizio).
 */
export interface ProcessedSessionsTable {
  session_id: string;
  /** Necessario per verificare l'ownership in GET /sessions/:id/status:
   *  questo servizio non ha piu' la tabella delle sessioni per una join. */
  user_id: string;
  processed_at: Generated<Date>;
  had_suggestions: boolean;
}

export interface Database {
  progression_events: ProgressionEventsTable;
  progression_preferences: ProgressionPreferencesTable;
  progression_defaults: ProgressionDefaultsTable;
  exercise_history_cache: ExerciseHistoryCacheTable;
  processed_sessions: ProcessedSessionsTable;
}

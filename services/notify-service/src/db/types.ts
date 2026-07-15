import type { ColumnType, Generated } from "kysely";

/**
 * Tipi delle tabelle per Kysely (unica fonte di verita' lato tipi). Le
 * migrazioni SQL in ./migrations devono restare allineate a queste interfacce.
 *
 * Nota: le colonne `numeric` (previous_value, suggested_value) tornano da
 * node-pg come stringa, quindi in select sono `string | null`; in
 * insert/update accettiamo `number | null` (stesso trattamento gia' visto in
 * workout-service/progress-service).
 */
export interface NotificationsTable {
  id: Generated<string>;
  owner_id: string;
  /** Non FK: il catalogo esercizi vive in workout-service. */
  exercise_id: string;
  exercise_name: string;
  /** "increase_weight" | "increase_reps" */
  suggestion_type: string;
  previous_value: ColumnType<string | null, number | null, number | null>;
  suggested_value: ColumnType<string | null, number | null, number | null>;
  reason: string;
  /** Non FK: la sessione vive in progress-service. */
  triggering_session_id: string;
  /** Id del ProgressionEvent originale (progress-service), per deduplicare. */
  progression_event_id: string;
  read_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  created_at: Generated<Date>;
}

export interface Database {
  notifications: NotificationsTable;
}

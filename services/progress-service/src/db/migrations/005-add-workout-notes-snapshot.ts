import type { Kysely } from "kysely";

/**
 * Snapshot di Workout.notes (non le note della sessione, gia' presenti come
 * `notes`) al momento del log: lo storico mostra le note della scheda sotto
 * il nome anche se la scheda cambia in seguito, stesso principio gia' usato
 * per rest_seconds/progression_increment.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sessions").addColumn("workout_notes", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sessions").dropColumn("workout_notes").execute();
}

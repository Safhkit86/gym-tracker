import { type Kysely, sql } from "kysely";

/**
 * Record personali (massimali) per esercizio: memoria permanente del
 * miglior set mai loggato, a differenza di exercise_history_cache che tiene
 * solo una finestra scorrevole delle ultime sessioni (non basterebbe a
 * rilevare un vero "mai fatto meglio di cosi'", vedi
 * personal-record-detector.ts). best_weight/best_weight_reps = il peso
 * (kg) piu' alto mai loggato su quell'esercizio e le rip. fatte a quel
 * peso; best_bodyweight_reps = le rip. piu' alte mai fatte quando
 * l'esercizio e' a corpo libero (nessun peso), indipendente dall'altra
 * coppia: un esercizio puo' avere entrambe le colonne popolate se e' stato
 * loggato sia pesato che a corpo libero in momenti diversi.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("personal_records")
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_name", "text", (col) => col.notNull())
    .addColumn("best_weight", sql`numeric(6, 2)`)
    .addColumn("best_weight_reps", "integer")
    .addColumn("best_bodyweight_reps", "integer")
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("personal_records_user_exercise_unique")
    .on("personal_records")
    .columns(["user_id", "exercise_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("personal_records").ifExists().execute();
}

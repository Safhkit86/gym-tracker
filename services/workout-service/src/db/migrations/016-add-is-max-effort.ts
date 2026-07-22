import { type Kysely, sql } from "kysely";

/**
 * Flag "sforzo massimo" (AMRAP - As Many Reps As Possible) per un set:
 * quando true, l'obiettivo non e' un numero di ripetizioni fisso ma "il piu'
 * possibile" (es. trazioni a cedimento). target_min_reps/target_max_reps
 * restano null in quel caso (vedi il refine dedicato in workout-routes.ts).
 * Un valore esplicito ad ogni riga (nessun default a livello di colonna),
 * coerente con lo stile del resto dello schema.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sets").addColumn("is_max_effort", "boolean").execute();
  await sql`UPDATE workout_sets SET is_max_effort = false`.execute(db);
  await db.schema
    .alterTable("workout_sets")
    .alterColumn("is_max_effort", (col) => col.setNotNull())
    .execute();

  // target_min_reps era NOT NULL: un set a sforzo massimo non ha un
  // obiettivo numerico, quindi deve poter restare null.
  await db.schema
    .alterTable("workout_sets")
    .alterColumn("target_min_reps", (col) => col.dropNotNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE workout_sets SET target_min_reps = 1 WHERE target_min_reps IS NULL`.execute(db);
  await db.schema
    .alterTable("workout_sets")
    .alterColumn("target_min_reps", (col) => col.setNotNull())
    .execute();
  await db.schema.alterTable("workout_sets").dropColumn("is_max_effort").execute();
}

import type { Kysely } from "kysely";

/**
 * Snapshot di WorkoutExercise.restSeconds al momento del log, stesso
 * pattern gia' usato per progression_increment: denormalizzato su ogni
 * set_number di uno stesso esercizio (la tabella non ha una riga per
 * esercizio, solo per set). Nullable: i log liberi non hanno prescrizione.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").addColumn("rest_seconds", "integer").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").dropColumn("rest_seconds").execute();
}

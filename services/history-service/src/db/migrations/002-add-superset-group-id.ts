import type { Kysely } from "kysely";

/**
 * Snapshot di WorkoutExercise.supersetGroupId al momento del log, stesso
 * pattern gia' usato per rest_seconds/progression_increment: denormalizzato
 * su ogni set_number di uno stesso esercizio (la tabella non ha una riga
 * per esercizio, solo per set). Nullable: esercizio non in un superset.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").addColumn("superset_group_id", "uuid").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").dropColumn("superset_group_id").execute();
}

import type { Kysely } from "kysely";

/**
 * Recupero TRA I SET dello stesso esercizio — concetto diverso dalla
 * colonna rest_seconds gia' esistente su session_sets (quella e' il
 * recupero prima di passare all'ESERCIZIO successivo, invariata).
 * target_rest_min/max_seconds sono lo snapshot del range prescritto
 * (WorkoutSet.restMinSeconds/restMaxSeconds) al momento del log;
 * actual_rest_seconds e' quanto l'utente ha effettivamente riposato tra
 * un set e il successivo, inserito nel form di log — stesso principio di
 * actual_reps rispetto a target_min_reps/target_max_reps.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("session_sets")
    .addColumn("target_rest_min_seconds", "integer")
    .execute();
  await db.schema
    .alterTable("session_sets")
    .addColumn("target_rest_max_seconds", "integer")
    .execute();
  await db.schema
    .alterTable("session_sets")
    .addColumn("actual_rest_seconds", "integer")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").dropColumn("actual_rest_seconds").execute();
  await db.schema.alterTable("session_sets").dropColumn("target_rest_max_seconds").execute();
  await db.schema.alterTable("session_sets").dropColumn("target_rest_min_seconds").execute();
}

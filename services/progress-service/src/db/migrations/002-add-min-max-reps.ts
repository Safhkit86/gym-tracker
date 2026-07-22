import { type Kysely, sql } from "kysely";

/**
 * Sostituisce lo snapshot singolo target_reps con una coppia min/max,
 * coerente col cambio corrispondente in workout-service. Entrambe restano
 * nullable (a differenza di workout-service): qui erano gia' opzionali per i
 * log liberi, e lo restano.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").addColumn("target_min_reps", "integer").execute();
  await db.schema.alterTable("session_sets").addColumn("target_max_reps", "integer").execute();

  await sql`UPDATE session_sets SET target_min_reps = target_reps`.execute(db);

  await db.schema.alterTable("session_sets").dropColumn("target_reps").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").addColumn("target_reps", "integer").execute();
  await sql`UPDATE session_sets SET target_reps = target_min_reps`.execute(db);
  await db.schema.alterTable("session_sets").dropColumn("target_min_reps").execute();
  await db.schema.alterTable("session_sets").dropColumn("target_max_reps").execute();
}

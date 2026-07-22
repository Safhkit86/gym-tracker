import { type Kysely, sql } from "kysely";

/**
 * Sostituisce il singolo rest_seconds (recupero tra le serie) con una coppia
 * min/max, per poter esprimere un range (es. 60-90s) invece di un solo
 * valore. A differenza di target_min_reps, restMinSeconds resta nullable:
 * il recupero era gia' opzionale ("non specificato"), e lo resta.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sets").addColumn("rest_min_seconds", "integer").execute();
  await db.schema.alterTable("workout_sets").addColumn("rest_max_seconds", "integer").execute();

  await sql`UPDATE workout_sets SET rest_min_seconds = rest_seconds`.execute(db);

  await db.schema.alterTable("workout_sets").dropColumn("rest_seconds").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sets").addColumn("rest_seconds", "integer").execute();
  await sql`UPDATE workout_sets SET rest_seconds = rest_min_seconds`.execute(db);
  await db.schema.alterTable("workout_sets").dropColumn("rest_min_seconds").execute();
  await db.schema.alterTable("workout_sets").dropColumn("rest_max_seconds").execute();
}

import { type Kysely, sql } from "kysely";

/**
 * Sostituisce il singolo target_reps con una coppia min/max, per poter
 * esprimere un range di ripetizioni (es. 8-12) invece di un solo valore.
 * Le minime sono sempre richieste; le massime restano opzionali (null =
 * nessun range, l'obiettivo e' il singolo valore minimo).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sets").addColumn("target_min_reps", "integer").execute();
  await db.schema.alterTable("workout_sets").addColumn("target_max_reps", "integer").execute();

  await sql`UPDATE workout_sets SET target_min_reps = target_reps`.execute(db);

  await db.schema
    .alterTable("workout_sets")
    .alterColumn("target_min_reps", (col) => col.setNotNull())
    .execute();
  await db.schema.alterTable("workout_sets").dropColumn("target_reps").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sets").addColumn("target_reps", "integer").execute();
  await sql`UPDATE workout_sets SET target_reps = target_min_reps`.execute(db);
  await db.schema
    .alterTable("workout_sets")
    .alterColumn("target_reps", (col) => col.setNotNull())
    .execute();
  await db.schema.alterTable("workout_sets").dropColumn("target_min_reps").execute();
  await db.schema.alterTable("workout_sets").dropColumn("target_max_reps").execute();
}

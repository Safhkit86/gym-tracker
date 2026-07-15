import { type Kysely, sql } from "kysely";

/**
 * Incremento di progressione per esercizio (kg se pesato, ripetizioni a
 * corpo libero), configurato da chi crea la scheda: progress-service (Fase
 * 3) lo legge come snapshot al momento del log di una sessione invece di
 * usare un valore fisso uguale per ogni esercizio.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("workout_exercises")
    .addColumn("progression_increment", sql`numeric(6, 2)`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_exercises").dropColumn("progression_increment").execute();
}

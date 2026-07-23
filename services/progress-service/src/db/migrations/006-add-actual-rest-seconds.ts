import type { Kysely } from "kysely";

/**
 * rest_seconds e' solo lo snapshot del recupero PRESCRITTO dalla scheda al
 * momento del log (mai modificabile dall'utente). actual_rest_seconds e'
 * il recupero EFFETTIVAMENTE preso prima dell'esercizio successivo,
 * inserito dall'utente nel form di log — stesso principio di
 * actual_reps/actual_weight rispetto ai target corrispondenti.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").addColumn("actual_rest_seconds", "integer").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").dropColumn("actual_rest_seconds").execute();
}

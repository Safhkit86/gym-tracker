import type { Kysely } from "kysely";

/**
 * Aggiunge: descrizione esecuzione + link sorgente sugli esercizi (niente
 * media incorporati, solo un rimando alla pagina originale, per non
 * hotlinkare immagini/video di terzi); recupero dopo l'esercizio (prima del
 * successivo, distinto dal recupero tra i singoli set) sulle righe
 * workout_exercises.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("exercises").addColumn("description", "text").execute();
  await db.schema.alterTable("exercises").addColumn("source_url", "text").execute();
  await db.schema.alterTable("workout_exercises").addColumn("rest_seconds", "integer").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_exercises").dropColumn("rest_seconds").execute();
  await db.schema.alterTable("exercises").dropColumn("source_url").execute();
  await db.schema.alterTable("exercises").dropColumn("description").execute();
}

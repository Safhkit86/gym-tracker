import { type Kysely, sql } from "kysely";

/**
 * Posizione delle schede nella lista di un utente, per permettere di
 * riordinarle (invece dell'ordine fisso per data di creazione). Backfill
 * per owner in base a created_at, cosi' le schede esistenti mantengono
 * l'ordine attuale al primo caricamento dopo il deploy.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workouts").addColumn("position", "integer").execute();

  await sql`
    UPDATE workouts AS w
    SET position = ranked.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) AS rn
      FROM workouts
    ) AS ranked
    WHERE w.id = ranked.id
  `.execute(db);

  await db.schema
    .alterTable("workouts")
    .alterColumn("position", (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workouts").dropColumn("position").execute();
}

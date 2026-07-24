import { type Kysely, sql } from "kysely";

/**
 * Preferenza distinta dal raggruppamento del motore di suggerimento
 * (grouping_scope): riguarda la precompilazione delle rep effettive
 * quando si apre Registra sessione (vedi LogSessionPage.tsx). Se le
 * ultime rep storicizzate da riproporre vengono cercate per
 * scheda+esercizio (default, comportamento storico) o per solo
 * esercizio, indipendentemente dalla scheda.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("progression_preferences")
    .addColumn("prefill_scope", "text", (col) => col.notNull().defaultTo("workout"))
    .execute();

  await sql`ALTER TABLE progression_preferences ADD CONSTRAINT progression_preferences_prefill_scope_check CHECK (prefill_scope IN ('workout', 'exercise'))`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("progression_preferences").dropColumn("prefill_scope").execute();
}

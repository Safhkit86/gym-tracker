import { type Kysely, sql } from "kysely";

/**
 * Preferenze per-utente che parametrizzano il motore di progressione
 * (progression-rule-engine.ts): quante sessioni consecutive al massimo
 * delle rep servono prima di suggerire un aumento (default 2, com'era
 * finora una costante globale) e se il conteggio raggruppa le sessioni
 * per scheda+esercizio (comportamento storico) o per solo esercizio,
 * indipendentemente dalla scheda in cui compare. Una riga per utente,
 * creata al primo salvataggio (nessun backfill per gli utenti esistenti:
 * l'assenza di riga vale come i default).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("progression_preferences")
    .addColumn("owner_id", "uuid", (col) => col.primaryKey())
    .addColumn("required_consecutive_sessions", "integer", (col) => col.notNull().defaultTo(2))
    .addColumn("grouping_scope", "text", (col) => col.notNull().defaultTo("workout"))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`ALTER TABLE progression_preferences ADD CONSTRAINT progression_preferences_grouping_scope_check CHECK (grouping_scope IN ('workout', 'exercise'))`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("progression_preferences").execute();
}

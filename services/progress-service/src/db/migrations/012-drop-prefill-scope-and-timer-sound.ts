import { type Kysely, sql } from "kysely";

/**
 * prefill_scope e timer_sound_enabled si spostano in account-service
 * (account_preferences): non riguardano il motore di progressione, solo
 * preferenze consumate lato client (vedi analisi architetturale). I valori
 * gia' salvati non vengono migrati: nessuna migrazione dovrebbe leggere le
 * tabelle di un altro servizio, anche se e' lo stesso database fisico.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("progression_preferences")
    .dropColumn("prefill_scope")
    .dropColumn("timer_sound_enabled")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("progression_preferences")
    .addColumn("prefill_scope", "text", (col) => col.notNull().defaultTo("workout"))
    .addColumn("timer_sound_enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  await sql`ALTER TABLE progression_preferences ADD CONSTRAINT progression_preferences_prefill_scope_check CHECK (prefill_scope IN ('workout', 'exercise'))`.execute(
    db
  );
}

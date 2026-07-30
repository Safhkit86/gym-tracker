import { type Kysely, sql } from "kysely";

/**
 * Preferenze utente non legate al motore di progressione (spostate da
 * progress-service, che resta responsabile solo della logica di
 * progressione): precompilazione delle rep in Registra sessione e suono del
 * timer di recupero, entrambe consumate solo lato client. Una riga per
 * utente, creata al primo salvataggio (nessun backfill per gli utenti
 * esistenti: l'assenza di riga vale come i default).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("account_preferences")
    .addColumn("user_id", "uuid", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade")
    )
    .addColumn("prefill_scope", "text", (col) => col.notNull().defaultTo("workout"))
    .addColumn("timer_sound_enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`ALTER TABLE account_preferences ADD CONSTRAINT account_preferences_prefill_scope_check CHECK (prefill_scope IN ('workout', 'exercise'))`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("account_preferences").execute();
}

import { type Kysely, sql } from "kysely";

/**
 * Tabella unica per token di reset password e OTP di conferma cambio
 * password, distinti da `purpose`: piu' auditabile di due tabelle separate
 * o di colonne su `users` (ogni richiesta lascia una riga tracciabile).
 * `pending_password_hash` e' popolato solo per purpose='change': l'hash
 * della nuova password, gia' calcolato al momento della richiesta, applicato
 * a `users.password_hash` solo alla conferma dell'OTP.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("password_action_tokens")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("purpose", "text", (col) => col.notNull())
    .addColumn("token_hash", "text", (col) => col.notNull().unique())
    .addColumn("pending_password_hash", "text")
    .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("used_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`ALTER TABLE password_action_tokens ADD CONSTRAINT password_action_tokens_purpose_check CHECK (purpose IN ('reset', 'change'))`.execute(
    db
  );

  await db.schema
    .createIndex("password_action_tokens_user_purpose_idx")
    .on("password_action_tokens")
    .columns(["user_id", "purpose", "created_at"])
    .execute();

  await db.schema.alterTable("users").addColumn("password_changed_at", "timestamptz").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("users").dropColumn("password_changed_at").execute();
  await db.schema.dropTable("password_action_tokens").execute();
}

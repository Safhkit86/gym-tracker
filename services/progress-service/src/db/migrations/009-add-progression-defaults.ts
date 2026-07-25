import { type Kysely, sql } from "kysely";

/**
 * Override "una tantum" del prefill di Registra sessione: quando l'utente
 * preme "Accetta progressione" su una notifica (vedi
 * progression-defaults-repository.ts), il valore suggerito diventa il
 * default per la PROSSIMA registrazione di quell'esercizio, in qualunque
 * scheda in cui compare — poi viene consumato (riga eliminata) da
 * SessionService.logSession, perche' da quel momento in poi il normale
 * prefill (ultima sessione registrata) riflette gia' il nuovo valore.
 * Una sola riga pendente per esercizio: un nuovo "accetta" sullo stesso
 * esercizio sovrascrive quella precedente non ancora consumata.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("progression_defaults")
    .addColumn("owner_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_id", "uuid", (col) => col.notNull())
    .addColumn("suggestion_type", "text", (col) => col.notNull())
    .addColumn("value", "numeric", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("progression_defaults_pkey", ["owner_id", "exercise_id"])
    .execute();

  await sql`ALTER TABLE progression_defaults ADD CONSTRAINT progression_defaults_suggestion_type_check CHECK (suggestion_type IN ('increase_weight', 'increase_reps'))`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("progression_defaults").execute();
}

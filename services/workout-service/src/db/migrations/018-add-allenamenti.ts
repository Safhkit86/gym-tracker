import { type Kysely, sql } from "kysely";

/**
 * Allenamenti: raggruppano le schede dell'utente (una scheda appartiene a
 * esattamente un allenamento) cosi' si puo' seguire un programma o un altro
 * a seconda dei periodi senza modificare le schede ogni volta. Al massimo un
 * allenamento per utente ha is_active = true (indice unico parziale sotto):
 * Registra sessione (nel punto d'accesso generale) e il "prossimo esercizio"
 * della Dashboard si limitano alle schede di quello attivo.
 *
 * Backfill: ogni utente che ha gia' delle schede riceve un allenamento di
 * default ("Allenamento 1"), attivo, con tutte le sue schede assegnate —
 * cosi' chi usa gia' l'app non vede alcuna differenza al primo caricamento
 * dopo il deploy (stesso trattamento della migrazione 011, position). Un
 * utente nuovo (nessuna scheda ancora) non ha ancora nessun allenamento:
 * se ne crea uno automaticamente alla prima scheda, vedi
 * AllenamentoService.resolveAllenamentoId.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("allenamenti")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("allenamenti_user_idx").on("allenamenti").column("user_id").execute();
  // Parziale (solo le righe is_active = true): consente a ogni utente
  // qualunque numero di allenamenti NON attivi, ma al massimo uno attivo.
  await sql`CREATE UNIQUE INDEX allenamenti_one_active_per_user ON allenamenti (user_id) WHERE is_active`.execute(
    db
  );

  await db.schema
    .alterTable("workouts")
    .addColumn("allenamento_id", "uuid", (col) => col.references("allenamenti.id"))
    .execute();

  await sql`
    INSERT INTO allenamenti (user_id, name, is_active)
    SELECT DISTINCT user_id, 'Allenamento 1', true FROM workouts
  `.execute(db);

  await sql`
    UPDATE workouts AS w
    SET allenamento_id = a.id
    FROM allenamenti AS a
    WHERE a.user_id = w.user_id
  `.execute(db);

  await db.schema
    .alterTable("workouts")
    .alterColumn("allenamento_id", (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workouts").dropColumn("allenamento_id").execute();
  await db.schema.dropTable("allenamenti").ifExists().execute();
}

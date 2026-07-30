import { type Kysely, sql } from "kysely";

/**
 * Split di history-service: `workout_sessions`/`session_sets` restano dove
 * sono fisicamente (nessuna DDL su di esse, dati reali dell'utente — vedi
 * history-service/src/db/migrate.ts), ma progress-service smette di
 * referenziarle nel proprio codice. L'unica vera modifica di schema e'
 * staccare l'FK reale (l'unica del sistema): da qui in poi history-service
 * pubblica `session-deleted` e questo servizio cancella lui stesso le righe
 * `progression_events` collegate (cascade applicativo, vedi
 * session-events-consumer.ts).
 *
 * Aggiunge anche le due tabelle nuove: `exercise_history_cache` (read-model
 * alimentato consumando `session-logged`, sostituisce le query dirette su
 * session_sets/workout_sessions per il motore di regole e per "esercizio in
 * stallo") e `processed_sessions` (marcatore per il polling di stato dopo
 * POST /sessions).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE progression_events DROP CONSTRAINT progression_events_triggering_session_id_fkey`.execute(
    db
  );

  await db.schema
    .createTable("exercise_history_cache")
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_id", "uuid", (col) => col.notNull())
    /** Snapshot dell'ultimo nome esercizio visto (session-logged): puo'
     *  invecchiare se l'utente rinomina un esercizio custom, stesso
     *  trattamento gia' accettato per session_sets.exercise_name. */
    .addColumn("exercise_name", "text", (col) => col.notNull())
    .addColumn("first_logged_at", "timestamptz", (col) => col.notNull())
    .addColumn("recent_outcomes", "text", (col) => col.notNull().defaultTo("[]"))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("exercise_history_cache_pkey", ["user_id", "exercise_id"])
    .execute();

  await db.schema
    .createTable("processed_sessions")
    .addColumn("session_id", "uuid", (col) => col.primaryKey())
    /** Necessario per verificare l'ownership in GET /sessions/:id/status:
     *  progress-service non ha piu' la tabella delle sessioni (vive in
     *  history-service) per controllarla con una join. */
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("processed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("had_suggestions", "boolean", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("processed_sessions").execute();
  await db.schema.dropTable("exercise_history_cache").execute();

  await sql`ALTER TABLE progression_events ADD CONSTRAINT progression_events_triggering_session_id_fkey FOREIGN KEY (triggering_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE`.execute(
    db
  );
}

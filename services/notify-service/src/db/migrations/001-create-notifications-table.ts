import { type Kysely, sql } from "kysely";

/**
 * Schema iniziale di notify-service: una riga per ogni evento di
 * progressione consumato dalla coda RabbitMQ "progression-events".
 * `owner_id`/`exercise_id`/`triggering_session_id` NON sono FK verso altri
 * servizi (confine tra servizi, stesso pattern di owner_id altrove).
 * Unique su (owner_id, progression_event_id): se RabbitMQ riconsegna lo
 * stesso messaggio, l'INSERT successivo e' un no-op (ON CONFLICT DO NOTHING
 * lato repository) invece di creare una notifica duplicata.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("notifications")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("owner_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_name", "text", (col) => col.notNull())
    .addColumn("suggestion_type", "text", (col) => col.notNull())
    .addColumn("previous_value", sql`numeric(6, 2)`)
    .addColumn("suggested_value", sql`numeric(6, 2)`)
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("triggering_session_id", "uuid", (col) => col.notNull())
    .addColumn("progression_event_id", "uuid", (col) => col.notNull())
    .addColumn("read_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("notifications_owner_created_idx")
    .on("notifications")
    .columns(["owner_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("notifications_owner_read_idx")
    .on("notifications")
    .columns(["owner_id", "read_at"])
    .execute();
  await db.schema
    .createIndex("notifications_owner_event_unique")
    .on("notifications")
    .columns(["owner_id", "progression_event_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("notifications").ifExists().execute();
}

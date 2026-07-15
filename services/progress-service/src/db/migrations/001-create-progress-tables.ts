import { type Kysely, sql } from "kysely";

/**
 * Schema iniziale di progress-service: sessioni eseguite (esecuzione reale
 * contro la prescrizione di workout-service, con snapshot denormalizzati di
 * nome scheda/esercizio/obiettivo/incremento configurato, per non chiamare
 * mai workout-service via HTTP) e suggerimenti del motore di progressione.
 * `owner_id`/`workout_id`/`exercise_id`/`workout_exercise_id` NON sono FK
 * verso workout-service (confine tra servizi, stesso pattern di owner_id in
 * workout-service).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("workout_sessions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("owner_id", "uuid", (col) => col.notNull())
    .addColumn("workout_id", "uuid", (col) => col.notNull())
    .addColumn("workout_name", "text", (col) => col.notNull())
    .addColumn("performed_at", "timestamptz", (col) => col.notNull())
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("workout_sessions_owner_idx")
    .on("workout_sessions")
    .column("owner_id")
    .execute();
  await db.schema
    .createIndex("workout_sessions_owner_workout_idx")
    .on("workout_sessions")
    .columns(["owner_id", "workout_id"])
    .execute();

  await db.schema
    .createTable("session_sets")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("session_id", "uuid", (col) =>
      col.notNull().references("workout_sessions.id").onDelete("cascade")
    )
    .addColumn("exercise_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_name", "text", (col) => col.notNull())
    .addColumn("workout_exercise_id", "uuid")
    .addColumn("set_number", "integer", (col) => col.notNull())
    .addColumn("target_reps", "integer")
    .addColumn("progression_increment", sql`numeric(6, 2)`)
    .addColumn("actual_reps", "integer", (col) => col.notNull())
    .addColumn("actual_weight", sql`numeric(6, 2)`)
    .addColumn("actual_rpe", "integer")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("session_sets_session_idx")
    .on("session_sets")
    .column("session_id")
    .execute();
  await db.schema
    .createIndex("session_sets_exercise_idx")
    .on("session_sets")
    .column("exercise_id")
    .execute();
  await db.schema
    .createIndex("session_sets_session_exercise_setnumber_unique")
    .on("session_sets")
    .columns(["session_id", "exercise_id", "set_number"])
    .unique()
    .execute();

  await db.schema
    .createTable("progression_events")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("owner_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_id", "uuid", (col) => col.notNull())
    .addColumn("exercise_name", "text", (col) => col.notNull())
    .addColumn("triggering_session_id", "uuid", (col) =>
      col.notNull().references("workout_sessions.id").onDelete("cascade")
    )
    .addColumn("suggestion_type", "text", (col) => col.notNull())
    .addColumn("previous_value", sql`numeric(6, 2)`)
    .addColumn("suggested_value", sql`numeric(6, 2)`)
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("source", "text", (col) => col.notNull().defaultTo("rule"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("progression_events_owner_created_idx")
    .on("progression_events")
    .columns(["owner_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("progression_events").ifExists().execute();
  await db.schema.dropTable("session_sets").ifExists().execute();
  await db.schema.dropTable("workout_sessions").ifExists().execute();
}

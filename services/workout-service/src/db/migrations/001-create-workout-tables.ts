import { type Kysely, sql } from "kysely";

/**
 * Schema iniziale di workout-service: catalogo esercizi + schede a 3 livelli
 * (workouts -> workout_exercises -> workout_sets). `gen_random_uuid()` e'
 * nativo in Postgres 13+. owner_id NON e' una FK verso auth-service (confine
 * tra servizi): e' il `sub` del JWT.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("exercises")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("owner_id", "uuid") // NULL = esercizio globale (seed)
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("muscle_group", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Unicita' del nome per proprietario. In Postgres NULL != NULL, quindi questo
  // indice non vincola i globali (owner_id IS NULL): per loro un unique parziale.
  await db.schema
    .createIndex("exercises_owner_name_unique")
    .on("exercises")
    .columns(["owner_id", "name"])
    .unique()
    .execute();
  await sql`CREATE UNIQUE INDEX exercises_global_name_unique ON exercises (name) WHERE owner_id IS NULL`.execute(
    db
  );

  await db.schema
    .createTable("workouts")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("owner_id", "uuid", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("workouts_owner_idx").on("workouts").column("owner_id").execute();

  await db.schema
    .createTable("workout_exercises")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("workout_id", "uuid", (col) =>
      col.notNull().references("workouts.id").onDelete("cascade")
    )
    .addColumn("exercise_id", "uuid", (col) =>
      col.notNull().references("exercises.id").onDelete("restrict")
    )
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("notes", "text")
    .execute();
  await db.schema
    .createIndex("workout_exercises_workout_position_unique")
    .on("workout_exercises")
    .columns(["workout_id", "position"])
    .unique()
    .execute();

  await db.schema
    .createTable("workout_sets")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("workout_exercise_id", "uuid", (col) =>
      col.notNull().references("workout_exercises.id").onDelete("cascade")
    )
    .addColumn("set_number", "integer", (col) => col.notNull())
    .addColumn("target_reps", "integer", (col) => col.notNull())
    .addColumn("target_weight", sql`numeric(6, 2)`)
    .addColumn("rest_seconds", "integer")
    .execute();
  await db.schema
    .createIndex("workout_sets_exercise_setnumber_unique")
    .on("workout_sets")
    .columns(["workout_exercise_id", "set_number"])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("workout_sets").ifExists().execute();
  await db.schema.dropTable("workout_exercises").ifExists().execute();
  await db.schema.dropTable("workouts").ifExists().execute();
  await db.schema.dropTable("exercises").ifExists().execute();
}

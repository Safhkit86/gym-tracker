import { type Kysely, sql } from "kysely";

const EXERCISE_NAME = "Dip alla power tower";
const MUSCLE_GROUP = "Tricipiti";
const DESCRIPTION =
  "Alla power tower, con i palmi sulle maniglie e il corpo sollevato da terra: scendi flettendo i gomiti mantenendo il busto eretto per isolare i tricipiti, poi spingi verso l'alto fino a estendere le braccia.";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`INSERT INTO exercises (name, muscle_group, description, source_url, owner_id) VALUES (${EXERCISE_NAME}, ${MUSCLE_GROUP}, ${DESCRIPTION}, NULL, NULL)`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM exercises WHERE owner_id IS NULL AND name = ${EXERCISE_NAME}`.execute(db);
}

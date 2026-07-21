import { type Kysely, sql } from "kysely";

const EXERCISE_NAME = "Curl panca Scott";
const MUSCLE_GROUP = "Bicipiti";
const DESCRIPTION =
  "Seduto o in piedi alla panca Scott, con la parte posteriore delle braccia appoggiata al supporto inclinato: fletti i gomiti portando il bilanciere o il manubrio verso le spalle, senza staccare le braccia dal supporto, poi torna giu' controllando la discesa.";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`INSERT INTO exercises (name, muscle_group, description, source_url, owner_id) VALUES (${EXERCISE_NAME}, ${MUSCLE_GROUP}, ${DESCRIPTION}, NULL, NULL)`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM exercises WHERE owner_id IS NULL AND name = ${EXERCISE_NAME}`.execute(db);
}

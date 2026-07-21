import { type Kysely, sql } from "kysely";

interface NewExercise {
  name: string;
  muscleGroup: string;
  description: string;
}

const NEW_EXERCISES: ReadonlyArray<NewExercise> = [
  {
    name: "AB Wheel",
    muscleGroup: "Addome",
    description:
      "In ginocchio, mani sulla ruota davanti a te: rotola in avanti estendendo il corpo il piu' possibile mantenendo l'addome contratto, poi torna alla posizione di partenza tirando con gli addominali, senza inarcare la schiena.",
  },
  {
    name: "Sollevamento ginocchia",
    muscleGroup: "Addome",
    description:
      "Appeso alla sbarra (o in appoggio su una power tower), solleva le ginocchia verso il petto contraendo l'addome, poi torna giu' controllando la discesa senza dondolare.",
  },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const exercise of NEW_EXERCISES) {
    await sql`INSERT INTO exercises (name, muscle_group, description, source_url, owner_id) VALUES (${exercise.name}, ${exercise.muscleGroup}, ${exercise.description}, NULL, NULL)`.execute(
      db
    );
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const names = NEW_EXERCISES.map((e) => e.name);
  await sql`DELETE FROM exercises WHERE owner_id IS NULL AND name = ANY(${names})`.execute(db);
}

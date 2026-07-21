import { type Kysely, sql } from "kysely";

interface NewExercise {
  name: string;
  muscleGroup: string;
}

const NEW_EXERCISES: ReadonlyArray<NewExercise> = [
  { name: "Trazioni negative", muscleGroup: "Schiena" },
  { name: "Trazioni presa neutra", muscleGroup: "Schiena" },
  { name: "Trazioni presa supina", muscleGroup: "Schiena" },
  { name: "Australian PushUp", muscleGroup: "Schiena" },
  { name: "Romanian Deadlift", muscleGroup: "Gambe" },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const exercise of NEW_EXERCISES) {
    await sql`INSERT INTO exercises (name, muscle_group, owner_id) VALUES (${exercise.name}, ${exercise.muscleGroup}, NULL)`.execute(
      db
    );
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const names = NEW_EXERCISES.map((e) => e.name);
  await sql`DELETE FROM exercises WHERE owner_id IS NULL AND name = ANY(${names})`.execute(db);
}

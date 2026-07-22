import { type Kysely, sql } from "kysely";

interface NewExercise {
  name: string;
  muscleGroup: string;
  description: string;
}

const NEW_EXERCISES: ReadonlyArray<NewExercise> = [
  {
    name: "Panca piana con manubri",
    muscleGroup: "Petto",
    description:
      "Sdraiato su una panca piana con un manubrio in ogni mano, gomiti piegati a circa 90 gradi: spingi i manubri verso l'alto fino a quasi toccarli sopra il petto, poi torna giu' controllando la discesa fino a sentire un buon allungamento del petto.",
  },
  {
    name: "Squeeze Press",
    muscleGroup: "Petto",
    description:
      "Sdraiato su una panca piana, tieni due manubri uniti davanti al petto con i palmi che si toccano: spingi verso l'alto mantenendo i manubri premuti l'uno contro l'altro per tutta la ripetizione, cosi' da massimizzare la contrazione del petto.",
  },
  {
    name: "Push-up presa stretta",
    muscleGroup: "Petto",
    description:
      "In posizione di piegamento con le mani vicine sotto il petto (pollici quasi a contatto), scendi mantenendo i gomiti stretti lungo i fianchi, poi spingi verso l'alto: enfatizza tricipiti e parte interna del petto rispetto al piegamento classico.",
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

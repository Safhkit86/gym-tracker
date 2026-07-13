import { type Kysely, sql } from "kysely";

/** Catalogo esercizi globali iniziale (owner_id NULL). */
const GLOBAL_EXERCISES: ReadonlyArray<{ name: string; muscleGroup: string }> = [
  { name: "Panca piana", muscleGroup: "Petto" },
  { name: "Squat", muscleGroup: "Gambe" },
  { name: "Stacco da terra", muscleGroup: "Schiena" },
  { name: "Trazioni alla sbarra", muscleGroup: "Schiena" },
  { name: "Military press", muscleGroup: "Spalle" },
  { name: "Rematore con bilanciere", muscleGroup: "Schiena" },
  { name: "Curl con bilanciere", muscleGroup: "Bicipiti" },
  { name: "French press", muscleGroup: "Tricipiti" },
  { name: "Leg press", muscleGroup: "Gambe" },
  { name: "Affondi", muscleGroup: "Gambe" },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  // Insert via SQL grezzo: le migrazioni usano Kysely<unknown> e non hanno lo
  // schema tipizzato per il query builder.
  for (const exercise of GLOBAL_EXERCISES) {
    await sql`INSERT INTO exercises (name, muscle_group, owner_id) VALUES (${exercise.name}, ${exercise.muscleGroup}, NULL)`.execute(
      db
    );
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM exercises WHERE owner_id IS NULL`.execute(db);
}

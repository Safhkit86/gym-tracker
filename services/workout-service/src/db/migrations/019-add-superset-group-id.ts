import type { Kysely } from "kysely";

/**
 * Esercizi con lo stesso superset_group_id vengono eseguiti uno dopo
 * l'altro senza riposo (es. Panca piana + Trazioni, poi riposo, poi si
 * ripete per il numero di round previsto) — vedi il commento su
 * WorkoutExerciseInput.supersetGroupId in @gym-tracker/shared per i vincoli
 * (almeno 2 membri, posizioni contigue, stesso numero di set), validati in
 * workout-routes.ts. null = esercizio singolo, non in superset — tutte le
 * righe esistenti restano cosi' senza bisogno di backfill.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_exercises").addColumn("superset_group_id", "uuid").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_exercises").dropColumn("superset_group_id").execute();
}

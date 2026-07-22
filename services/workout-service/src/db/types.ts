import type { ColumnType, Generated } from "kysely";

/**
 * Tipi delle tabelle per Kysely (unica fonte di verita' lato tipi). Le
 * migrazioni SQL in ./migrations devono restare allineate a queste interfacce.
 *
 * Nota: le colonne `numeric` (target_weight) tornano da node-pg come stringa,
 * quindi in select sono `string`; in insert/update accettiamo `number`.
 */
export interface ExercisesTable {
  id: Generated<string>;
  owner_id: string | null;
  name: string;
  muscle_group: string | null;
  /** Come eseguire l'esercizio; null per gli esercizi creati dagli utenti. */
  description: string | null;
  /** Link a una pagina sorgente (non un'immagine/video incorporati); null se non disponibile. */
  source_url: string | null;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface WorkoutsTable {
  id: Generated<string>;
  owner_id: string;
  name: string;
  notes: string | null;
  position: number;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface WorkoutExercisesTable {
  id: Generated<string>;
  workout_id: string;
  exercise_id: string;
  position: number;
  notes: string | null;
  /** Recupero dopo questo esercizio, prima del successivo (secondi); null = non specificato. */
  rest_seconds: number | null;
  progression_increment: ColumnType<string | null, number | null, number | null>;
}

export interface WorkoutSetsTable {
  id: Generated<string>;
  workout_exercise_id: string;
  set_number: number;
  /** null quando is_max_effort e' true: uno sforzo massimo (AMRAP) non ha
   *  un obiettivo numerico di ripetizioni. */
  target_min_reps: number | null;
  /** null = nessun range: l'obiettivo e' il singolo valore target_min_reps. */
  target_max_reps: number | null;
  target_weight: ColumnType<string | null, number | null, number | null>;
  /** null = recupero non specificato. */
  rest_min_seconds: number | null;
  /** null = nessun range: il recupero e' il singolo valore rest_min_seconds
   *  (o non specificato se anche rest_min_seconds e' null). */
  rest_max_seconds: number | null;
  /** true = l'obiettivo e' "il piu' possibile" (AMRAP), non un numero fisso;
   *  in quel caso target_min_reps/target_max_reps sono null. */
  is_max_effort: boolean;
}

export interface Database {
  exercises: ExercisesTable;
  workouts: WorkoutsTable;
  workout_exercises: WorkoutExercisesTable;
  workout_sets: WorkoutSetsTable;
}

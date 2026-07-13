/**
 * Contratti di workout-service: schede (workout), esercizi del catalogo e la
 * prescrizione a 3 livelli Workout -> WorkoutExercise -> WorkoutSet.
 * Modellano la SCHEDA (cosa fare); l'esecuzione reale sara' di progress-service.
 */

/** Esercizio del catalogo. `ownerId` null = esercizio globale (seed). */
export interface Exercise {
  id: string;
  ownerId: string | null;
  name: string;
  muscleGroup: string | null;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup?: string | null;
}

// --- Input (body di POST/PUT /workouts) ---

export interface WorkoutSetInput {
  setNumber: number;
  targetReps: number;
  /** kg; null = a corpo libero */
  targetWeight?: number | null;
  restSeconds?: number | null;
}

export interface WorkoutExerciseInput {
  exerciseId: string;
  position: number;
  notes?: string | null;
  sets: WorkoutSetInput[];
}

export interface WorkoutInput {
  name: string;
  notes?: string | null;
  exercises: WorkoutExerciseInput[];
}

// --- Output ---

export interface WorkoutSet {
  id: string;
  setNumber: number;
  targetReps: number;
  targetWeight: number | null;
  restSeconds: number | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  /** denormalizzato per comodita' del client */
  exerciseName: string;
  position: number;
  notes: string | null;
  sets: WorkoutSet[];
}

/** Vista sintetica per la lista schede. */
export interface WorkoutSummary {
  id: string;
  name: string;
  notes: string | null;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Vista completa: scheda con esercizi e set. */
export interface WorkoutDetail {
  id: string;
  name: string;
  notes: string | null;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

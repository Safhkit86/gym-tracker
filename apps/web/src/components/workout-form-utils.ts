import type { Exercise, WorkoutDetail, WorkoutInput } from "@gym-tracker/shared";

export interface SetForm {
  targetReps: string;
  targetWeight: string;
  restSeconds: string;
}

export interface ExerciseForm {
  exerciseId: string;
  notes: string;
  /** Recupero dopo questo esercizio, prima del successivo. */
  restSeconds: string;
  /** Incremento (kg o reps) da suggerire quando progress-service rileva che
   *  e' il momento di progredire su questo esercizio; vuoto = non configurato. */
  progressionIncrement: string;
  sets: SetForm[];
}

export function emptySet(): SetForm {
  return { targetReps: "", targetWeight: "", restSeconds: "" };
}

export function emptyExercise(defaultExerciseId: string): ExerciseForm {
  return {
    exerciseId: defaultExerciseId,
    notes: "",
    restSeconds: "",
    progressionIncrement: "",
    sets: [emptySet()],
  };
}

/** Raggruppa il catalogo per gruppo muscolare, per una scelta piu' rapida
 * tra i tanti esercizi disponibili (mostrato con <optgroup>). */
export function groupByMuscle(catalog: Exercise[]): Array<[string, Exercise[]]> {
  const groups = new Map<string, Exercise[]>();
  for (const exercise of catalog) {
    const key = exercise.muscleGroup ?? "Altro";
    const list = groups.get(key) ?? [];
    list.push(exercise);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

/** Converte il form in un WorkoutInput: posizioni e numeri di set sono
 * derivati dall'ordine, cosi' sono sempre univoci per costruzione. */
export function toWorkoutInput(
  name: string,
  notes: string,
  exercises: ExerciseForm[]
): WorkoutInput {
  return {
    name: name.trim(),
    notes: notes.trim() || undefined,
    exercises: exercises.map((exercise, exerciseIndex) => ({
      exerciseId: exercise.exerciseId,
      position: exerciseIndex + 1,
      notes: exercise.notes.trim() || undefined,
      restSeconds: exercise.restSeconds.trim() ? Number(exercise.restSeconds) : undefined,
      progressionIncrement: exercise.progressionIncrement.trim()
        ? Number(exercise.progressionIncrement)
        : undefined,
      sets: exercise.sets.map((set, setIndex) => ({
        setNumber: setIndex + 1,
        targetReps: Number(set.targetReps),
        targetWeight: set.targetWeight.trim() ? Number(set.targetWeight) : undefined,
        restSeconds: set.restSeconds.trim() ? Number(set.restSeconds) : undefined,
      })),
    })),
  };
}

/** Converte una scheda esistente nei valori iniziali del form (inverso di
 * toWorkoutInput): numeri nullable -> stringa vuota, riordinati per
 * position/setNumber nel caso il server non li restituisca gia' ordinati. */
export function workoutDetailToFormValues(workout: WorkoutDetail): {
  name: string;
  notes: string;
  exercises: ExerciseForm[];
} {
  const exercises = [...workout.exercises]
    .sort((a, b) => a.position - b.position)
    .map((exercise) => ({
      exerciseId: exercise.exerciseId,
      notes: exercise.notes ?? "",
      restSeconds: exercise.restSeconds !== null ? String(exercise.restSeconds) : "",
      progressionIncrement:
        exercise.progressionIncrement !== null ? String(exercise.progressionIncrement) : "",
      sets: [...exercise.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
          targetReps: String(set.targetReps),
          targetWeight: set.targetWeight !== null ? String(set.targetWeight) : "",
          restSeconds: set.restSeconds !== null ? String(set.restSeconds) : "",
        })),
    }));
  return { name: workout.name, notes: workout.notes ?? "", exercises };
}

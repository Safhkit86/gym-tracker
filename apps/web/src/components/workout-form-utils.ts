import type { Exercise, WorkoutDetail, WorkoutInput } from "@gym-tracker/shared";

export interface SetForm {
  targetMinReps: string;
  /** Vuoto = nessun range: l'obiettivo e' il singolo valore targetMinReps. */
  targetMaxReps: string;
  targetWeight: string;
  restSeconds: string;
}

export interface ExerciseForm {
  /** Chiave stabile lato client per il drag-and-drop (dnd-kit): mai inviata
   *  al backend, ignorata da toWorkoutInput. */
  formId: string;
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
  return { targetMinReps: "", targetMaxReps: "", targetWeight: "", restSeconds: "" };
}

export function emptyExercise(defaultExerciseId: string): ExerciseForm {
  return {
    formId: crypto.randomUUID(),
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
        targetMinReps: Number(set.targetMinReps),
        targetMaxReps: set.targetMaxReps.trim() ? Number(set.targetMaxReps) : undefined,
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
      formId: crypto.randomUUID(),
      exerciseId: exercise.exerciseId,
      notes: exercise.notes ?? "",
      restSeconds: exercise.restSeconds !== null ? String(exercise.restSeconds) : "",
      progressionIncrement:
        exercise.progressionIncrement !== null ? String(exercise.progressionIncrement) : "",
      sets: [...exercise.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
          targetMinReps: String(set.targetMinReps),
          targetMaxReps: set.targetMaxReps !== null ? String(set.targetMaxReps) : "",
          targetWeight: set.targetWeight !== null ? String(set.targetWeight) : "",
          restSeconds: set.restSeconds !== null ? String(set.restSeconds) : "",
        })),
    }));
  return { name: workout.name, notes: workout.notes ?? "", exercises };
}

/** Costruisce il WorkoutInput per una scheda duplicata: stesso contenuto
 * della scheda di partenza (notes/esercizi/set) con un nome nuovo. Passando
 * per toWorkoutInput/createWorkout, la copia ottiene id nuovi per ogni
 * workout_exercise/workout_set: nessun riferimento condiviso con l'originale. */
export function duplicateWorkoutInput(workout: WorkoutDetail, newName: string): WorkoutInput {
  const { notes, exercises } = workoutDetailToFormValues(workout);
  return toWorkoutInput(newName, notes, exercises);
}

/** Estrae i path dei campi (formato zod, es. "exercises.0.sets.0.targetMinReps"
 *  oppure "exercises.0.sets.0" per un refine cross-campo come min<=max) da
 *  ApiRequestError.details di un 400 VALIDATION_ERROR: usato per evidenziare
 *  il campo incriminato nel form invece del solo messaggio generico in cima. */
export function extractFieldErrorPaths(details: Record<string, unknown> | undefined): Set<string> {
  const issues = details?.issues;
  if (!Array.isArray(issues)) {
    return new Set();
  }
  const paths = new Set<string>();
  for (const issue of issues) {
    const path = (issue as { path?: unknown } | null)?.path;
    if (typeof path === "string") {
      paths.add(path);
    }
  }
  return paths;
}

/** True se il set alla posizione data ha un errore sulle rep minime: match
 *  esatto sul campo, oppure sull'intero set (refine cross-campo min<=max,
 *  che non punta a un singolo campo — in quel caso si evidenziano entrambi). */
export function setMinRepsHasError(
  fieldErrors: Set<string>,
  exerciseIndex: number,
  setIndex: number
): boolean {
  const rowPath = `exercises.${exerciseIndex}.sets.${setIndex}`;
  return fieldErrors.has(rowPath) || fieldErrors.has(`${rowPath}.targetMinReps`);
}

/** Vedi setMinRepsHasError: stessa logica per le rep massime. */
export function setMaxRepsHasError(
  fieldErrors: Set<string>,
  exerciseIndex: number,
  setIndex: number
): boolean {
  const rowPath = `exercises.${exerciseIndex}.sets.${setIndex}`;
  return fieldErrors.has(rowPath) || fieldErrors.has(`${rowPath}.targetMaxReps`);
}

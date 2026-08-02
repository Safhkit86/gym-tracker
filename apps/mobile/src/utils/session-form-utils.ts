import type {
  ProgressionDefault,
  SessionDetail,
  SessionInput,
  WorkoutDetail,
} from "@gym-tracker/shared";

export interface SessionSetForm {
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  isMaxEffort: boolean;
  actualReps: string;
  /** Snapshot del recupero tra questo set e il successivo (mai modificabile
   *  qui): l'utente inserisce un solo "recupero effettivo" per l'intero
   *  esercizio (vedi SessionExerciseForm.actualRestSeconds), applicato a
   *  tutti i set nel payload — stesso trattamento del peso. */
  targetRestMinSeconds: number | null;
  targetRestMaxSeconds: number | null;
}

interface RestRangeTarget {
  targetRestMinSeconds: number | null;
  targetRestMaxSeconds: number | null;
}

export interface SessionExerciseForm {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string;
  progressionIncrement: number | null;
  /** Recupero prima di passare all'esercizio successivo: solo informativo
   *  in questa schermata (mostrato tra un esercizio e il successivo, mai
   *  modificabile). */
  restSeconds: number | null;
  targetRestMinSeconds: number | null;
  targetRestMaxSeconds: number | null;
  actualRestSeconds: string;
  /** true quando la scheda non prevede un peso per questo esercizio. */
  isBodyweight: boolean;
  actualWeight: string;
  sets: SessionSetForm[];
}

export function formatSetTarget(set: SessionSetForm, t: (key: string) => string): string {
  if (set.isMaxEffort) {
    return t("workouts.detail.maxEffort");
  }
  if (set.targetMinReps === null) {
    return "—";
  }
  return set.targetMaxReps !== null
    ? `${set.targetMinReps}-${set.targetMaxReps}`
    : String(set.targetMinReps);
}

/** true se la stringa rappresenta un numero di secondi valido per avviare
 *  un timer (vuoto/0/negativo/non numerico -> pulsante disabilitato). */
export function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return value.trim() !== "" && !Number.isNaN(parsed) && parsed > 0;
}

export function formatRestRange(target: RestRangeTarget): string {
  if (target.targetRestMinSeconds === null) {
    return "—";
  }
  return target.targetRestMaxSeconds !== null
    ? `${target.targetRestMinSeconds}-${target.targetRestMaxSeconds}s`
    : `${target.targetRestMinSeconds}s`;
}

/** Peso/recupero dell'ultima sessione registrata per la stessa scheda+
 *  esercizio (non il target della scheda): le sessioni arrivano gia'
 *  ordinate dal piu' recente (GET /sessions), quindi la prima corrispondenza
 *  trovata e' quella buona. null se l'esercizio non e' mai stato registrato
 *  prima. */
function findPreviousExerciseValue(
  previousSessions: SessionDetail[],
  workoutId: string,
  exerciseId: string,
  field: "actualWeight" | "actualRestSeconds"
): number | null {
  for (const session of previousSessions) {
    if (session.workoutId !== workoutId) {
      continue;
    }
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    const value = exercise?.sets[0]?.[field];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

/** Stesso set (stesso numero) dell'ultima sessione registrata per lo stesso
 *  esercizio: da qui vengono le rep effettive di default, non dall'obiettivo
 *  della scheda. `scope` e' la preferenza utente (Profilo > Preferenze):
 *  "workout" (default) considera solo le sessioni della stessa scheda,
 *  "exercise" l'esercizio ovunque compaia. */
function findPreviousSetReps(
  previousSessions: SessionDetail[],
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  scope: "workout" | "exercise"
): number | null {
  for (const session of previousSessions) {
    if (scope === "workout" && session.workoutId !== workoutId) {
      continue;
    }
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    const set = exercise?.sets.find((s) => s.setNumber === setNumber);
    if (set) {
      return set.actualReps;
    }
  }
  return null;
}

/** Precompila il form di log: rep effettive, peso e recupero effettivo
 *  partono tutti dall'ULTIMA sessione registrata per lo stesso esercizio di
 *  questa scheda (non dall'obiettivo). Solo se non c'e' ancora storico si
 *  ripiega sull'obiettivo della scheda. Un override "accetta progressione"
 *  pendente per un esercizio ha priorita' assoluta — stesso comportamento
 *  di apps/web/src/pages/LogSessionPage.tsx (buildInitialExercises). */
export function buildInitialExercises(
  workout: WorkoutDetail,
  previousSessions: SessionDetail[],
  repsPrefillScope: "workout" | "exercise",
  progressionDefaults: ProgressionDefault[]
): SessionExerciseForm[] {
  const defaultsByExerciseId = new Map(progressionDefaults.map((d) => [d.exerciseId, d]));

  return workout.exercises.map((exercise) => {
    const override = defaultsByExerciseId.get(exercise.exerciseId);
    const firstSet = exercise.sets[0];
    const targetWeight = firstSet?.targetWeight ?? null;
    const previousWeight = findPreviousExerciseValue(
      previousSessions,
      workout.id,
      exercise.exerciseId,
      "actualWeight"
    );
    const initialWeight =
      override?.suggestionType === "increase_weight"
        ? override.value
        : (previousWeight ?? targetWeight);

    const previousRestSeconds = findPreviousExerciseValue(
      previousSessions,
      workout.id,
      exercise.exerciseId,
      "actualRestSeconds"
    );
    const initialRestSeconds = previousRestSeconds ?? firstSet?.restMinSeconds ?? null;

    return {
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      workoutExerciseId: exercise.id,
      progressionIncrement: exercise.progressionIncrement,
      restSeconds: exercise.restSeconds,
      targetRestMinSeconds: firstSet?.restMinSeconds ?? null,
      targetRestMaxSeconds: firstSet?.restMaxSeconds ?? null,
      actualRestSeconds: initialRestSeconds !== null ? String(initialRestSeconds) : "",
      isBodyweight: targetWeight === null,
      actualWeight: targetWeight !== null && initialWeight !== null ? String(initialWeight) : "",
      sets: exercise.sets.map((set) => {
        if (override?.suggestionType === "increase_reps") {
          return {
            setNumber: set.setNumber,
            targetMinReps: set.targetMinReps,
            targetMaxReps: set.targetMaxReps,
            isMaxEffort: set.isMaxEffort,
            actualReps: String(override.value),
            targetRestMinSeconds: set.restMinSeconds,
            targetRestMaxSeconds: set.restMaxSeconds,
          };
        }
        const previousReps = findPreviousSetReps(
          previousSessions,
          workout.id,
          exercise.exerciseId,
          set.setNumber,
          repsPrefillScope
        );
        const actualReps =
          previousReps !== null
            ? String(previousReps)
            : set.isMaxEffort
              ? ""
              : String(set.targetMinReps);
        return {
          setNumber: set.setNumber,
          targetMinReps: set.targetMinReps,
          targetMaxReps: set.targetMaxReps,
          isMaxEffort: set.isMaxEffort,
          actualReps,
          targetRestMinSeconds: set.restMinSeconds,
          targetRestMaxSeconds: set.restMaxSeconds,
        };
      }),
    };
  });
}

/** Converte il form nel body di POST /sessions. */
export function toSessionInput(
  workout: WorkoutDetail,
  performedAt: string,
  exercises: SessionExerciseForm[]
): SessionInput {
  return {
    workoutId: workout.id,
    workoutName: workout.name,
    workoutNotes: workout.notes ?? undefined,
    performedAt: new Date(performedAt).toISOString(),
    exercises: exercises.map((exercise) => {
      const actualWeight =
        !exercise.isBodyweight && exercise.actualWeight.trim()
          ? Number(exercise.actualWeight)
          : undefined;
      const actualRestSeconds = exercise.actualRestSeconds.trim()
        ? Number(exercise.actualRestSeconds)
        : undefined;
      return {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        workoutExerciseId: exercise.workoutExerciseId,
        progressionIncrement: exercise.progressionIncrement ?? undefined,
        restSeconds: exercise.restSeconds ?? undefined,
        sets: exercise.sets.map((set) => ({
          setNumber: set.setNumber,
          targetMinReps: set.targetMinReps ?? undefined,
          targetMaxReps: set.targetMaxReps ?? undefined,
          actualReps: Number(set.actualReps),
          actualWeight,
          targetRestMinSeconds: set.targetRestMinSeconds ?? undefined,
          targetRestMaxSeconds: set.targetRestMaxSeconds ?? undefined,
          actualRestSeconds,
        })),
      };
    }),
  };
}

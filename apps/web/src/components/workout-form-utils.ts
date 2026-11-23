import type { Exercise, WorkoutDetail, WorkoutInput } from "@gym-tracker/shared";

export interface SetForm {
  targetMinReps: string;
  /** Vuoto = nessun range: l'obiettivo e' il singolo valore targetMinReps. */
  targetMaxReps: string;
  targetWeight: string;
  /** Vuoto = recupero non specificato. */
  restMinSeconds: string;
  /** Vuoto = nessun range: il recupero e' il singolo valore restMinSeconds
   *  (o non specificato se anche restMinSeconds e' vuoto). Richiede restMinSeconds. */
  restMaxSeconds: string;
  /** true = sforzo massimo (AMRAP): targetMinReps/targetMaxReps vengono
   *  ignorati e non inviati al server. */
  isMaxEffort: boolean;
}

export interface ExerciseForm {
  /** Chiave stabile lato client per il drag-and-drop (dnd-kit): mai inviata
   *  al backend, ignorata da toWorkoutInput. */
  formId: string;
  exerciseId: string;
  notes: string;
  /** Recupero dopo questo esercizio, prima del successivo. Per un esercizio
   *  non ultimo del proprio superset (vedi supersetGroupId), il campo non
   *  viene mostrato nel form ed e' sempre inviato come assente da
   *  toWorkoutInput, indipendentemente da questo valore — nessuna pausa tra
   *  gli esercizi dello stesso giro, vedi isLastInSupersetGroup. */
  restSeconds: string;
  /** Incremento (kg o reps) da suggerire quando progress-service rileva che
   *  e' il momento di progredire su questo esercizio; vuoto = non configurato. */
  progressionIncrement: string;
  /** Esercizi con lo stesso id sono un superset (eseguiti senza riposo tra
   *  loro, poi riposo, poi si ripete); null = esercizio singolo. Assegnato
   *  da groupAsSuperset, rimosso da ungroupSuperset. */
  supersetGroupId: string | null;
  sets: SetForm[];
}

export function emptySet(): SetForm {
  return {
    targetMinReps: "",
    targetMaxReps: "",
    targetWeight: "",
    restMinSeconds: "",
    restMaxSeconds: "",
    isMaxEffort: false,
  };
}

export function emptyExercise(defaultExerciseId: string): ExerciseForm {
  return {
    formId: crypto.randomUUID(),
    exerciseId: defaultExerciseId,
    notes: "",
    restSeconds: "",
    progressionIncrement: "",
    supersetGroupId: null,
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

/** True se non c'e' nessun esercizio successivo nello stesso superset: solo
 *  per questo esercizio il riposo "prima del prossimo" ha senso ed e'
 *  inviato al server — un esercizio non ultimo del gruppo lo ha sempre
 *  assente (nessuna pausa tra gli esercizi dello stesso giro). Un esercizio
 *  senza supersetGroupId e' sempre "ultimo" (caso normale, invariato). */
export function isLastInSupersetGroup(exercises: ExerciseForm[], index: number): boolean {
  const groupId = exercises[index]?.supersetGroupId;
  if (!groupId) {
    return true;
  }
  return !exercises.slice(index + 1).some((e) => e.supersetGroupId === groupId);
}

/** True se gli indici selezionati (2+) possono diventare un superset:
 *  adiacenti nell'array corrente, nessuno gia' in un gruppo, stesso numero
 *  di set tra tutti — stessi vincoli validati anche server-side in
 *  workout-routes.ts, controllati qui prima per un errore immediato invece
 *  di aspettare il submit. */
export function canGroupAsSuperset(exercises: ExerciseForm[], indices: number[]): boolean {
  if (indices.length < 2) {
    return false;
  }
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i] as number;
    if (i > 0 && current !== (sorted[i - 1] as number) + 1) {
      return false;
    }
    if (exercises[current]?.supersetGroupId) {
      return false;
    }
  }
  const setCount = exercises[sorted[0] as number]?.sets.length;
  return sorted.every((i) => exercises[i]?.sets.length === setCount);
}

/** Assegna un nuovo supersetGroupId condiviso agli esercizi agli indici
 *  dati; chiamare solo dopo aver verificato canGroupAsSuperset. */
export function groupAsSuperset(exercises: ExerciseForm[], indices: number[]): ExerciseForm[] {
  const groupId = crypto.randomUUID();
  const indexSet = new Set(indices);
  return exercises.map((exercise, i) =>
    indexSet.has(i) ? { ...exercise, supersetGroupId: groupId } : exercise
  );
}

/** Rimuove supersetGroupId da tutti gli esercizi del gruppo dato: tornano
 *  esercizi singoli indipendenti. */
export function ungroupSuperset(exercises: ExerciseForm[], groupId: string): ExerciseForm[] {
  return exercises.map((exercise) =>
    exercise.supersetGroupId === groupId ? { ...exercise, supersetGroupId: null } : exercise
  );
}

/** Etichetta "A1"/"A2"/"B1"... per esercizio raggruppato (una lettera per
 *  gruppo distinto, nell'ordine in cui compaiono nella scheda; un numero
 *  per membro all'interno del gruppo) — chiave per formId, non indice:
 *  stabile anche se l'array viene riordinato/filtrato. Assente per gli
 *  esercizi non raggruppati. */
export function supersetLabels(exercises: ExerciseForm[]): Map<string, string> {
  const letterByGroup = new Map<string, string>();
  const nextMemberByGroup = new Map<string, number>();
  const labels = new Map<string, string>();
  let nextLetterCode = 65; // "A"
  for (const exercise of exercises) {
    if (!exercise.supersetGroupId) {
      continue;
    }
    let letter = letterByGroup.get(exercise.supersetGroupId);
    if (!letter) {
      letter = String.fromCharCode(nextLetterCode++);
      letterByGroup.set(exercise.supersetGroupId, letter);
      nextMemberByGroup.set(exercise.supersetGroupId, 1);
    }
    const member = nextMemberByGroup.get(exercise.supersetGroupId) as number;
    labels.set(exercise.formId, `${letter}${member}`);
    nextMemberByGroup.set(exercise.supersetGroupId, member + 1);
  }
  return labels;
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
      restSeconds:
        exercise.restSeconds.trim() && isLastInSupersetGroup(exercises, exerciseIndex)
          ? Number(exercise.restSeconds)
          : undefined,
      progressionIncrement: exercise.progressionIncrement.trim()
        ? Number(exercise.progressionIncrement)
        : undefined,
      supersetGroupId: exercise.supersetGroupId ?? undefined,
      sets: exercise.sets.map((set, setIndex) => ({
        setNumber: setIndex + 1,
        targetMinReps: set.isMaxEffort
          ? undefined
          : set.targetMinReps.trim()
            ? Number(set.targetMinReps)
            : undefined,
        targetMaxReps:
          set.isMaxEffort || !set.targetMaxReps.trim() ? undefined : Number(set.targetMaxReps),
        targetWeight: set.targetWeight.trim() ? Number(set.targetWeight) : undefined,
        restMinSeconds: set.restMinSeconds.trim() ? Number(set.restMinSeconds) : undefined,
        restMaxSeconds: set.restMaxSeconds.trim() ? Number(set.restMaxSeconds) : undefined,
        isMaxEffort: set.isMaxEffort,
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
      supersetGroupId: exercise.supersetGroupId,
      sets: [...exercise.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
          targetMinReps: set.targetMinReps !== null ? String(set.targetMinReps) : "",
          targetMaxReps: set.targetMaxReps !== null ? String(set.targetMaxReps) : "",
          targetWeight: set.targetWeight !== null ? String(set.targetWeight) : "",
          restMinSeconds: set.restMinSeconds !== null ? String(set.restMinSeconds) : "",
          restMaxSeconds: set.restMaxSeconds !== null ? String(set.restMaxSeconds) : "",
          isMaxEffort: set.isMaxEffort ?? false,
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

/** Stesso riuso di duplicateWorkoutInput, ma per PUT /workouts/:id con un
 *  allenamentoId diverso (sposta una scheda tra allenamenti, vedi
 *  AllenamentiPage): nome/esercizi invariati, serve comunque il body
 *  completo perche' PUT sostituisce l'intera scheda. */
export function moveWorkoutInput(workout: WorkoutDetail, allenamentoId: string): WorkoutInput {
  const { notes, exercises } = workoutDetailToFormValues(workout);
  return { ...toWorkoutInput(workout.name, notes, exercises), allenamentoId };
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
 *  esatto sul campo, oppure sul path dedicato del refine cross-campo
 *  min<=max ("_repsRange", vedi setSchema in workout-routes.ts) — quel
 *  refine non punta a un singolo campo, quindi si evidenziano entrambi
 *  (min e max) senza toccare la coppia indipendente di recupero. */
export function setMinRepsHasError(
  fieldErrors: Set<string>,
  exerciseIndex: number,
  setIndex: number
): boolean {
  const rowPath = `exercises.${exerciseIndex}.sets.${setIndex}`;
  return fieldErrors.has(`${rowPath}._repsRange`) || fieldErrors.has(`${rowPath}.targetMinReps`);
}

/** Vedi setMinRepsHasError: stessa logica per le rep massime. */
export function setMaxRepsHasError(
  fieldErrors: Set<string>,
  exerciseIndex: number,
  setIndex: number
): boolean {
  const rowPath = `exercises.${exerciseIndex}.sets.${setIndex}`;
  return fieldErrors.has(`${rowPath}._repsRange`) || fieldErrors.has(`${rowPath}.targetMaxReps`);
}

/** Vedi setMinRepsHasError: stessa logica per il recupero minimo tra le
 *  serie, con il proprio path dedicato ("_restRange") indipendente da
 *  "_repsRange". */
export function setRestMinSecondsHasError(
  fieldErrors: Set<string>,
  exerciseIndex: number,
  setIndex: number
): boolean {
  const rowPath = `exercises.${exerciseIndex}.sets.${setIndex}`;
  return fieldErrors.has(`${rowPath}._restRange`) || fieldErrors.has(`${rowPath}.restMinSeconds`);
}

/** Vedi setMinRepsHasError: stessa logica per il recupero massimo tra le serie. */
export function setRestMaxSecondsHasError(
  fieldErrors: Set<string>,
  exerciseIndex: number,
  setIndex: number
): boolean {
  const rowPath = `exercises.${exerciseIndex}.sets.${setIndex}`;
  return fieldErrors.has(`${rowPath}._restRange`) || fieldErrors.has(`${rowPath}.restMaxSeconds`);
}

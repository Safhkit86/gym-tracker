import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Exercise, WorkoutInput } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { listExercises } from "../api/exercises";
import { createWorkout } from "../api/workouts";
import { ApiRequestError } from "../api/client";

interface SetForm {
  targetReps: string;
  targetWeight: string;
  restSeconds: string;
}

interface ExerciseForm {
  exerciseId: string;
  notes: string;
  /** Recupero dopo questo esercizio, prima del successivo. */
  restSeconds: string;
  /** Incremento (kg o reps) da suggerire quando progress-service rileva che
   *  e' il momento di progredire su questo esercizio; vuoto = non configurato. */
  progressionIncrement: string;
  sets: SetForm[];
}

function emptySet(): SetForm {
  return { targetReps: "", targetWeight: "", restSeconds: "" };
}

function emptyExercise(defaultExerciseId: string): ExerciseForm {
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
function groupByMuscle(catalog: Exercise[]): Array<[string, Exercise[]]> {
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
function toWorkoutInput(name: string, notes: string, exercises: ExerciseForm[]): WorkoutInput {
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

export function CreateWorkoutPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    listExercises(token)
      .then((result) => {
        setCatalog(result);
        if (result.length > 0) {
          setExercises([emptyExercise(result[0].id)]);
        }
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : "Impossibile caricare il catalogo esercizi."
        );
      });
  }, [token]);

  function addExercise(): void {
    const defaultId = catalog?.[0]?.id ?? "";
    setExercises((current) => [...current, emptyExercise(defaultId)]);
  }

  function removeExercise(index: number): void {
    setExercises((current) => current.filter((_, i) => i !== index));
  }

  function updateExercise(index: number, patch: Partial<ExerciseForm>): void {
    setExercises((current) =>
      current.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise))
    );
  }

  function addSet(exerciseIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex ? { ...exercise, sets: [...exercise.sets, emptySet()] } : exercise
      )
    );
  }

  /** Aggiunge una copia dell'ultimo set, cosi' non si riparte da zero quando
   * i set successivi hanno gli stessi (o quasi) reps/peso/recupero. */
  function duplicateSet(exerciseIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) => {
        if (i !== exerciseIndex) {
          return exercise;
        }
        const lastSet = exercise.sets[exercise.sets.length - 1];
        return { ...exercise, sets: [...exercise.sets, { ...lastSet }] };
      })
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? { ...exercise, sets: exercise.sets.filter((_, j) => j !== setIndex) }
          : exercise
      )
    );
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetForm>): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
            }
          : exercise
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!token) {
      return;
    }
    if (exercises.length === 0) {
      setError("Aggiungi almeno un esercizio.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createWorkout(token, toWorkoutInput(name, notes, exercises));
      navigate(`/workouts/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  if (catalog === null) {
    return (
      <main>
        <p>Caricamento…</p>
      </main>
    );
  }

  if (catalog.length === 0) {
    return (
      <main>
        <p>Nessun esercizio disponibile nel catalogo.</p>
      </main>
    );
  }

  const groupedCatalog = groupByMuscle(catalog);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  return (
    <main>
      <h1>Nuova scheda</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Nome
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Note
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>

        {exercises.map((exercise, exerciseIndex) => {
          const selected = catalogById.get(exercise.exerciseId);
          return (
            <fieldset key={exerciseIndex} className="exercise-form">
              <legend>Esercizio {exerciseIndex + 1}</legend>
              {/* Il <select> NON e' annidato nel <label> (a differenza degli
                  altri campi): il nome accessibile di un <label> include il
                  testo di tutti i suoi discendenti, quindi annidare un select
                  con decine di <option> lo renderebbe "Esercizio Affondi Hack
                  squat ..." per uno screen reader. Associazione esplicita via
                  htmlFor/id, con i due come fratelli. */}
              <div className="field">
                <label htmlFor={`exercise-select-${exerciseIndex}`}>Esercizio</label>
                <select
                  id={`exercise-select-${exerciseIndex}`}
                  value={exercise.exerciseId}
                  onChange={(event) =>
                    updateExercise(exerciseIndex, { exerciseId: event.target.value })
                  }
                >
                  {groupedCatalog.map(([muscleGroup, items]) => (
                    <optgroup key={muscleGroup} label={muscleGroup}>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {selected?.description && (
                <p className="exercise-description">
                  {selected.description}{" "}
                  {selected.sourceUrl && (
                    <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                      Scopri di più
                    </a>
                  )}
                </p>
              )}

              {exercise.sets.map((set, setIndex) => (
                <div key={setIndex} className="set-form-row">
                  <label>
                    Reps
                    <input
                      type="number"
                      min={1}
                      value={set.targetReps}
                      onChange={(event) =>
                        updateSet(exerciseIndex, setIndex, { targetReps: event.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Peso (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={set.targetWeight}
                      onChange={(event) =>
                        updateSet(exerciseIndex, setIndex, { targetWeight: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Recupero (s)
                    <input
                      type="number"
                      min={0}
                      value={set.restSeconds}
                      onChange={(event) =>
                        updateSet(exerciseIndex, setIndex, { restSeconds: event.target.value })
                      }
                    />
                  </label>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeSet(exerciseIndex, setIndex)}
                    >
                      Rimuovi set
                    </button>
                  )}
                </div>
              ))}
              <div className="exercise-form__actions">
                <button type="button" className="secondary" onClick={() => addSet(exerciseIndex)}>
                  Aggiungi set
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => duplicateSet(exerciseIndex)}
                >
                  Duplica ultimo set
                </button>
              </div>

              <label>
                Recupero prima del prossimo esercizio (s)
                <input
                  type="number"
                  min={0}
                  value={exercise.restSeconds}
                  onChange={(event) =>
                    updateExercise(exerciseIndex, { restSeconds: event.target.value })
                  }
                />
              </label>

              <label>
                Incremento di progressione (kg o reps)
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={exercise.progressionIncrement}
                  onChange={(event) =>
                    updateExercise(exerciseIndex, { progressionIncrement: event.target.value })
                  }
                />
              </label>

              {exercises.length > 1 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => removeExercise(exerciseIndex)}
                >
                  Rimuovi esercizio
                </button>
              )}
            </fieldset>
          );
        })}

        <button type="button" className="secondary" onClick={addExercise}>
          Aggiungi esercizio
        </button>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvataggio…" : "Crea scheda"}
        </button>
      </form>
    </main>
  );
}

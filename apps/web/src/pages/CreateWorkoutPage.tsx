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
  sets: SetForm[];
}

function emptySet(): SetForm {
  return { targetReps: "", targetWeight: "", restSeconds: "" };
}

function emptyExercise(defaultExerciseId: string): ExerciseForm {
  return { exerciseId: defaultExerciseId, notes: "", sets: [emptySet()] };
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

        {exercises.map((exercise, exerciseIndex) => (
          <fieldset key={exerciseIndex} className="exercise-form">
            <legend>Esercizio {exerciseIndex + 1}</legend>
            <label>
              Esercizio
              <select
                value={exercise.exerciseId}
                onChange={(event) =>
                  updateExercise(exerciseIndex, { exerciseId: event.target.value })
                }
              >
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

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
            <button type="button" className="secondary" onClick={() => addSet(exerciseIndex)}>
              Aggiungi set
            </button>

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
        ))}

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

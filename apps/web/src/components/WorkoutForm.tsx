import { useState, type FormEvent } from "react";
import type { Exercise, WorkoutInput } from "@gym-tracker/shared";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  emptyExercise,
  emptySet,
  groupByMuscle,
  toWorkoutInput,
  type ExerciseForm,
  type SetForm,
} from "./workout-form-utils";

interface WorkoutFormProps {
  catalog: Exercise[];
  initialName?: string;
  initialNotes?: string;
  initialExercises?: ExerciseForm[];
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: WorkoutInput) => Promise<void>;
}

export function WorkoutForm({
  catalog,
  initialName,
  initialNotes,
  initialExercises,
  submitLabel,
  submittingLabel,
  onSubmit,
}: WorkoutFormProps) {
  const [name, setName] = useState(initialName ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [exercises, setExercises] = useState<ExerciseForm[]>(
    initialExercises ?? [emptyExercise(catalog[0]?.id ?? "")]
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exerciseToRemove, setExerciseToRemove] = useState<number | null>(null);

  function addExercise(): void {
    const defaultId = catalog[0]?.id ?? "";
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

    if (exercises.length === 0) {
      setError("Aggiungi almeno un esercizio.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(toWorkoutInput(name, notes, exercises));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  const groupedCatalog = groupByMuscle(catalog);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  return (
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
                onClick={() => setExerciseToRemove(exerciseIndex)}
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
        {isSubmitting ? submittingLabel : submitLabel}
      </button>

      <ConfirmDialog
        open={exerciseToRemove !== null}
        message="Sei sicuro di voler eliminare l'esercizio?"
        onConfirm={() => {
          if (exerciseToRemove !== null) {
            removeExercise(exerciseToRemove);
          }
          setExerciseToRemove(null);
        }}
        onCancel={() => setExerciseToRemove(null)}
      />
    </form>
  );
}

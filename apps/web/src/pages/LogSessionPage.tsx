import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreateSessionResponse, WorkoutDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { getWorkout } from "../api/workouts";
import { logSession } from "../api/sessions";
import { ApiRequestError } from "../api/client";

interface SessionSetForm {
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  targetWeight: number | null;
  /** Snapshot locale (mai inviato a progress-service, che continua a
   *  ricevere solo targetMinReps/targetMaxReps): usato solo per mostrare
   *  "Max sforzo" invece di "—" nel testo dell'obiettivo. */
  isMaxEffort: boolean;
  actualReps: string;
  actualWeight: string;
  actualRpe: string;
}

interface SessionExerciseForm {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string;
  progressionIncrement: number | null;
  restSeconds: number | null;
  sets: SessionSetForm[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Precompila il form di log dalla scheda: reps/peso effettivi partono
 *  uguali all'obiettivo, l'utente li corregge se ha fatto altro. */
function buildInitialExercises(workout: WorkoutDetail): SessionExerciseForm[] {
  return workout.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    workoutExerciseId: exercise.id,
    progressionIncrement: exercise.progressionIncrement,
    restSeconds: exercise.restSeconds,
    sets: exercise.sets.map((set) => ({
      setNumber: set.setNumber,
      targetMinReps: set.targetMinReps,
      targetMaxReps: set.targetMaxReps,
      targetWeight: set.targetWeight,
      isMaxEffort: set.isMaxEffort,
      // Precompilato con le rep minime: e' il valore prescritto sempre presente,
      // le massime sono solo l'estremo superiore di un range opzionale. Per
      // uno sforzo massimo non c'e' un numero da precompilare: campo vuoto.
      actualReps: set.isMaxEffort ? "" : String(set.targetMinReps),
      actualWeight: set.targetWeight !== null ? String(set.targetWeight) : "",
      actualRpe: "",
    })),
  }));
}

export function LogSessionPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<SessionExerciseForm[]>([]);
  const [performedAt, setPerformedAt] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CreateSessionResponse | null>(null);

  useEffect(() => {
    if (!token || !id) {
      return;
    }
    getWorkout(token, id)
      .then((detail) => {
        setWorkout(detail);
        setExercises(buildInitialExercises(detail));
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err.message : "Impossibile caricare la scheda.");
      });
  }, [token, id]);

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<SessionSetForm>
  ): void {
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
    if (!token || !workout) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await logSession(token, {
        workoutId: workout.id,
        workoutName: workout.name,
        performedAt: new Date(performedAt).toISOString(),
        notes: notes.trim() || undefined,
        exercises: exercises.map((exercise) => ({
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
            actualWeight: set.actualWeight.trim() ? Number(set.actualWeight) : undefined,
            actualRpe: set.actualRpe.trim() ? Number(set.actualRpe) : undefined,
          })),
        })),
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error && !workout) {
    return (
      <main>
        <p role="alert" className="form-error">
          {error}
        </p>
        <Link to="/workouts">Torna alle schede</Link>
      </main>
    );
  }

  if (!workout) {
    return (
      <main>
        <p>Caricamento…</p>
      </main>
    );
  }

  if (result) {
    return (
      <main>
        <div className="card">
          <h1>Sessione registrata</h1>
          <p>
            {workout.name} — {new Date(result.performedAt).toLocaleDateString("it-IT")}
          </p>
          {result.suggestions.length === 0 ? (
            <p>Nessun suggerimento di progressione questa volta.</p>
          ) : (
            result.suggestions.map((suggestion) => (
              <p key={suggestion.id} className="progression-suggestion">
                <strong>{suggestion.exerciseName}</strong>: {suggestion.reason}
              </p>
            ))
          )}
          <p>
            <Link to={`/workouts/${workout.id}`}>Torna alla scheda</Link>
            {" · "}
            <Link to="/sessions">Vedi storico</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link to={`/workouts/${workout.id}`}>← {workout.name}</Link>
      </p>
      <h1>Registra sessione</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Data
          <input
            type="date"
            value={performedAt}
            onChange={(event) => setPerformedAt(event.target.value)}
            required
          />
        </label>
        <label>
          Note
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>

        {exercises.map((exercise, exerciseIndex) => (
          <fieldset key={exercise.workoutExerciseId} className="exercise-form">
            <legend>{exercise.exerciseName}</legend>
            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="set-form-row">
                <span>
                  Set {set.setNumber} — obiettivo:{" "}
                  {set.isMaxEffort
                    ? "il piu' possibile (AMRAP)"
                    : `${
                        set.targetMinReps === null
                          ? "—"
                          : set.targetMaxReps !== null
                            ? `${set.targetMinReps}-${set.targetMaxReps}`
                            : set.targetMinReps
                      } reps`}
                  {set.targetWeight !== null ? ` a ${set.targetWeight} kg` : " a corpo libero"}
                </span>
                <label>
                  Reps effettive
                  <input
                    type="number"
                    min={0}
                    value={set.actualReps}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, { actualReps: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Peso effettivo (kg)
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={set.actualWeight}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, { actualWeight: event.target.value })
                    }
                  />
                </label>
                <label>
                  RPE
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={set.actualRpe}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, { actualRpe: event.target.value })
                    }
                  />
                </label>
              </div>
            ))}
          </fieldset>
        ))}

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvataggio…" : "Registra sessione"}
        </button>
      </form>
    </main>
  );
}

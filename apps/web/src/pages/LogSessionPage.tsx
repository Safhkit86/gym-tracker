import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreateSessionResponse, SessionDetail, WorkoutDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { getWorkout } from "../api/workouts";
import { listSessions, logSession } from "../api/sessions";
import { ApiRequestError } from "../api/client";

interface SessionSetForm {
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  isMaxEffort: boolean;
  actualReps: string;
}

interface SessionExerciseForm {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string;
  progressionIncrement: number | null;
  /** Recupero prescritto dalla scheda (mai modificabile: e' l'obiettivo). */
  restSeconds: number | null;
  /** Recupero effettivamente preso, editabile dall'utente. */
  actualRestSeconds: string;
  /** true quando la scheda non prevede un peso per questo esercizio: la
   *  colonna Kg resta "corpo libero", senza campo editabile. */
  isBodyweight: boolean;
  actualWeight: string;
  sets: SessionSetForm[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatSetTarget(set: SessionSetForm): string {
  if (set.isMaxEffort) {
    return "Max";
  }
  if (set.targetMinReps === null) {
    return "—";
  }
  return set.targetMaxReps !== null
    ? `${set.targetMinReps}-${set.targetMaxReps}`
    : String(set.targetMinReps);
}

/** Peso dell'ultima sessione registrata per la stessa scheda+esercizio (non
 *  il target della scheda): le sessioni arrivano gia' ordinate dal piu'
 *  recente (GET /sessions), quindi la prima corrispondenza trovata e' quella
 *  buona. null se l'esercizio non e' mai stato registrato prima. */
function findPreviousWeight(
  previousSessions: SessionDetail[],
  workoutId: string,
  exerciseId: string
): number | null {
  for (const session of previousSessions) {
    if (session.workoutId !== workoutId) {
      continue;
    }
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    const weight = exercise?.sets[0]?.actualWeight;
    if (weight !== undefined && weight !== null) {
      return weight;
    }
  }
  return null;
}

/** Precompila il form di log dalla scheda: reps effettive partono uguali
 *  all'obiettivo (minime, o vuote per uno sforzo massimo), il peso parte da
 *  quello usato l'ultima volta (o dal target della scheda se e' la prima
 *  volta), il recupero effettivo parte da quello prescritto. L'utente
 *  corregge quello che ha fatto di diverso. */
function buildInitialExercises(
  workout: WorkoutDetail,
  previousSessions: SessionDetail[]
): SessionExerciseForm[] {
  return workout.exercises.map((exercise) => {
    const targetWeight = exercise.sets[0]?.targetWeight ?? null;
    const previousWeight = findPreviousWeight(previousSessions, workout.id, exercise.exerciseId);
    const initialWeight = previousWeight ?? targetWeight;
    return {
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      workoutExerciseId: exercise.id,
      progressionIncrement: exercise.progressionIncrement,
      restSeconds: exercise.restSeconds,
      actualRestSeconds: exercise.restSeconds !== null ? String(exercise.restSeconds) : "",
      isBodyweight: targetWeight === null,
      actualWeight: targetWeight !== null && initialWeight !== null ? String(initialWeight) : "",
      sets: exercise.sets.map((set) => ({
        setNumber: set.setNumber,
        targetMinReps: set.targetMinReps,
        targetMaxReps: set.targetMaxReps,
        isMaxEffort: set.isMaxEffort,
        actualReps: set.isMaxEffort ? "" : String(set.targetMinReps),
      })),
    };
  });
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
    Promise.all([getWorkout(token, id), listSessions(token)])
      .then(([detail, previousSessions]) => {
        setWorkout(detail);
        setExercises(buildInitialExercises(detail, previousSessions));
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err.message : "Impossibile caricare la scheda.");
      });
  }, [token, id]);

  function updateExercise(exerciseIndex: number, patch: Partial<SessionExerciseForm>): void {
    setExercises((current) =>
      current.map((exercise, i) => (i === exerciseIndex ? { ...exercise, ...patch } : exercise))
    );
  }

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
        workoutNotes: workout.notes ?? undefined,
        performedAt: new Date(performedAt).toISOString(),
        notes: notes.trim() || undefined,
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
            actualRestSeconds,
            sets: exercise.sets.map((set) => ({
              setNumber: set.setNumber,
              targetMinReps: set.targetMinReps ?? undefined,
              targetMaxReps: set.targetMaxReps ?? undefined,
              actualReps: Number(set.actualReps),
              actualWeight,
            })),
          };
        }),
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

  const maxSets = Math.max(1, ...exercises.map((e) => e.sets.length));

  return (
    <main className="main-wide">
      <p>
        <Link to={`/workouts/${workout.id}`}>← {workout.name}</Link>
      </p>
      <h1>Registra sessione</h1>
      <form onSubmit={handleSubmit}>
        <section className="card session-card">
          <div className="session-card__header">
            <div className="session-card__title">
              <h2>{workout.name}</h2>
              {workout.notes && <p className="session-card__notes">{workout.notes}</p>}
            </div>
            <input
              type="date"
              className="session-card__date-input"
              aria-label="Data sessione"
              value={performedAt}
              onChange={(event) => setPerformedAt(event.target.value)}
              required
            />
          </div>

          <label>
            Note
            <input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <div className="table-scroll">
            <table className="log-session-table">
              <thead>
                <tr>
                  <th>Esercizio</th>
                  {Array.from({ length: maxSets }, (_, i) => (
                    <th key={i}>Set {i + 1}</th>
                  ))}
                  <th>Kg</th>
                  <th>Recupero</th>
                </tr>
              </thead>
              <tbody>
                {exercises.map((exercise, exerciseIndex) => (
                  <tr key={exercise.workoutExerciseId}>
                    <td>{exercise.exerciseName}</td>
                    {Array.from({ length: maxSets }, (_, setIndex) => {
                      const set = exercise.sets[setIndex];
                      if (!set) {
                        return <td key={setIndex} />;
                      }
                      return (
                        <td key={setIndex}>
                          <div className="log-cell">
                            <span className="log-cell__target">{formatSetTarget(set)}</span>
                            <input
                              type="number"
                              min={0}
                              value={set.actualReps}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  actualReps: event.target.value,
                                })
                              }
                              aria-label={`${exercise.exerciseName} set ${set.setNumber} rep effettive`}
                              required
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td>
                      {exercise.isBodyweight ? (
                        "corpo libero"
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={exercise.actualWeight}
                          onChange={(event) =>
                            updateExercise(exerciseIndex, { actualWeight: event.target.value })
                          }
                          aria-label={`${exercise.exerciseName} kg effettivi`}
                        />
                      )}
                    </td>
                    <td>
                      <div className="log-cell">
                        <span className="log-cell__target">
                          {exercise.restSeconds !== null ? `${exercise.restSeconds}s` : "—"}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={exercise.actualRestSeconds}
                          onChange={(event) =>
                            updateExercise(exerciseIndex, {
                              actualRestSeconds: event.target.value,
                            })
                          }
                          aria-label={`${exercise.exerciseName} recupero effettivo`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}

          <div className="session-card__actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvataggio…" : "Registra sessione"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}

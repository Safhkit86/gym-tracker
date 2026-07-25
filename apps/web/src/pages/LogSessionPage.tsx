import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  CreateSessionResponse,
  ProgressionDefault,
  SessionDetail,
  WorkoutDetail,
} from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { useUnreadCount } from "../notifications/useUnreadCount";
import { getWorkout } from "../api/workouts";
import { listSessions, logSession } from "../api/sessions";
import { getProgressionDefaults, getProgressionPreferences } from "../api/profile";
import { ApiRequestError } from "../api/client";
import { NARROW_TABLE_LAYOUT_QUERY, useIsNarrowViewport } from "../hooks/useIsNarrowViewport";
import { useRestTimers } from "../hooks/useRestTimers";
import { RestTimerTray } from "../components/RestTimerTray";
import { IconButton } from "../components/IconButton";
import { TimerIcon } from "../components/icons";

interface SessionSetForm {
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

interface SessionExerciseForm {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string;
  progressionIncrement: number | null;
  /** Recupero prima di passare all'esercizio successivo: solo informativo
   *  in questa pagina (mostrato come riga separatrice tra un esercizio e
   *  il successivo, mai modificabile). */
  restSeconds: number | null;
  /** Recupero tra i set: obiettivo (range, dal primo set) + effettivo
   *  (editabile, un solo valore per l'intero esercizio). */
  targetRestMinSeconds: number | null;
  targetRestMaxSeconds: number | null;
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

/** true se la stringa rappresenta un numero di secondi valido per avviare
 *  un timer (vuoto/0/negativo/non numerico -> pulsante disabilitato). */
function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return value.trim() !== "" && !Number.isNaN(parsed) && parsed > 0;
}

function formatRestRange(target: RestRangeTarget): string {
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
 *  prima. Un solo valore per esercizio (dal primo set, come per il peso). */
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
 *  della scheda (vedi buildInitialExercises). `scope` e' la preferenza
 *  utente "Riporta ultime ripetizioni effettive di default da" (Profilo >
 *  Preferenze): `"workout"` (default) considera solo le sessioni della
 *  stessa scheda, `"exercise"` l'esercizio ovunque compaia. null se quel
 *  set non e' mai stato registrato prima nello scope scelto. */
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
 *  questa scheda (non dall'obiettivo) — se il range e' 6-10 e l'ultima volta
 *  si sono fatte 9 rep, riparte da 9. Solo se non c'e' ancora storico per
 *  quell'esercizio si ripiega sull'obiettivo della scheda (rep minime, peso
 *  target, recupero minimo). L'utente conferma o corregge.
 *
 *  `repsPrefillScope` (preferenza utente) si applica SOLO alle rep: peso e
 *  recupero restano cercati per scheda+esercizio come sempre, l'utente ha
 *  chiesto la preferenza specificamente per le rep.
 *
 *  Un override "accetta progressione" pendente per un esercizio (vedi
 *  Notifiche) ha priorita' assoluta sulle due fonti sopra per quell'unico
 *  esercizio: `increase_weight` sostituisce il peso di default,
 *  `increase_reps` sostituisce le rep di default su tutti i suoi set. */
function buildInitialExercises(
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

export function LogSessionPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { refreshUnreadCount } = useUnreadCount();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<SessionExerciseForm[]>([]);
  const [performedAt, setPerformedAt] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CreateSessionResponse | null>(null);
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(false);
  const isNarrow = useIsNarrowViewport(NARROW_TABLE_LAYOUT_QUERY);
  const { timers, startTimer, cancelTimer, snoozeTimer } = useRestTimers(timerSoundEnabled);

  useEffect(() => {
    if (!token || !id) {
      return;
    }
    Promise.all([
      getWorkout(token, id),
      listSessions(token),
      getProgressionPreferences(token),
      getProgressionDefaults(token),
    ])
      .then(([detail, previousSessions, preferences, progressionDefaults]) => {
        setWorkout(detail);
        setExercises(
          buildInitialExercises(
            detail,
            previousSessions,
            preferences.prefillScope,
            progressionDefaults
          )
        );
        setTimerSoundEnabled(preferences.timerSoundEnabled);
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
      });
      setResult(response);
      if (response.suggestions.length > 0) {
        // Restando su questa pagina (nessuna navigazione) il cambio di rotta
        // in Layout non scatta da solo: senza questa chiamata il badge
        // resterebbe fermo finche' l'utente non naviga altrove.
        refreshUnreadCount();
      }
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
        <RestTimerTray timers={timers} onCancel={cancelTimer} onSnooze={snoozeTimer} />
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
    <main className="main-wide main-wide-table">
      <RestTimerTray timers={timers} onCancel={cancelTimer} onSnooze={snoozeTimer} />
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

          {isNarrow ? (
            <div className="stack-table">
              {exercises.map((exercise, exerciseIndex) => (
                <Fragment key={exercise.workoutExerciseId}>
                  <div className="stack-block">
                    <h3>{exercise.exerciseName}</h3>
                    {exercise.sets.map((set, setIndex) => (
                      <div className="stack-row" key={setIndex}>
                        <span className="stack-label">
                          Set {set.setNumber}{" "}
                          <span className="log-cell__target">({formatSetTarget(set)})</span>
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={set.actualReps}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, { actualReps: event.target.value })
                          }
                          aria-label={`${exercise.exerciseName} set ${set.setNumber} rep effettive`}
                          required
                        />
                      </div>
                    ))}
                    <div className="stack-row">
                      <span className="stack-label">Kg</span>
                      {exercise.isBodyweight ? (
                        <span>corpo libero</span>
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
                    </div>
                    <div className="stack-row">
                      <span className="stack-label">
                        Recupero{" "}
                        <span className="log-cell__target">({formatRestRange(exercise)})</span>
                      </span>
                      <div className="input-with-button">
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
                        <IconButton
                          icon={<TimerIcon />}
                          label="Avvia timer recupero"
                          disabled={!isPositiveNumber(exercise.actualRestSeconds)}
                          onClick={() =>
                            startTimer(
                              Number(exercise.actualRestSeconds),
                              `${exercise.exerciseName} — recupero tra le serie`
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  {exerciseIndex < exercises.length - 1 && exercise.restSeconds !== null && (
                    <div className="rest-divider-stack">
                      <span className="rest-divider">
                        Recupero prima del prossimo esercizio: {exercise.restSeconds}s
                      </span>
                      <IconButton
                        icon={<TimerIcon />}
                        label="Avvia timer recupero"
                        disabled={!exercise.restSeconds || exercise.restSeconds <= 0}
                        onClick={() =>
                          startTimer(
                            exercise.restSeconds as number,
                            `Prima di ${exercises[exerciseIndex + 1].exerciseName}`
                          )
                        }
                      />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          ) : (
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
                    <Fragment key={exercise.workoutExerciseId}>
                      <tr>
                        <td>
                          <div className="log-exercise-name">
                            <span>{exercise.exerciseName}</span>
                          </div>
                        </td>
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
                          <div className="log-cell">
                            {/* Riga vuota: nessun obiettivo di peso mostrato qui, ma la
                                stessa altezza della riga target di Set N/Recupero tiene
                                la casella allineata verticalmente con quelle della riga. */}
                            <span className="log-cell__target">&nbsp;</span>
                            {exercise.isBodyweight ? (
                              "corpo libero"
                            ) : (
                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                value={exercise.actualWeight}
                                onChange={(event) =>
                                  updateExercise(exerciseIndex, {
                                    actualWeight: event.target.value,
                                  })
                                }
                                aria-label={`${exercise.exerciseName} kg effettivi`}
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="log-cell">
                            <span className="log-cell__target">{formatRestRange(exercise)}</span>
                            <div className="input-with-button">
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
                              <IconButton
                                icon={<TimerIcon />}
                                label="Avvia timer recupero"
                                disabled={!isPositiveNumber(exercise.actualRestSeconds)}
                                onClick={() =>
                                  startTimer(
                                    Number(exercise.actualRestSeconds),
                                    `${exercise.exerciseName} — recupero tra le serie`
                                  )
                                }
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                      {exerciseIndex < exercises.length - 1 && exercise.restSeconds !== null && (
                        <tr className="rest-divider-row">
                          <td colSpan={maxSets + 3}>
                            <div className="rest-divider-content">
                              <span className="rest-divider">
                                Recupero prima del prossimo esercizio: {exercise.restSeconds}s
                              </span>
                              <IconButton
                                icon={<TimerIcon />}
                                label="Avvia timer recupero"
                                disabled={!exercise.restSeconds || exercise.restSeconds <= 0}
                                onClick={() =>
                                  startTimer(
                                    exercise.restSeconds as number,
                                    `Prima di ${exercises[exerciseIndex + 1].exerciseName}`
                                  )
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

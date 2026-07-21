import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ProgressionEvent, WorkoutDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { deleteWorkout, getWorkout } from "../api/workouts";
import { listProgressionEvents } from "../api/progression";
import { ApiRequestError } from "../api/client";

export function WorkoutDetailPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [suggestions, setSuggestions] = useState<ProgressionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!token || !id) {
      return;
    }
    let cancelled = false;
    getWorkout(token, id)
      .then((result) => {
        if (!cancelled) {
          setWorkout(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError ? err.message : "Impossibile caricare la scheda."
          );
        }
      });
    // I suggerimenti sono un'aggiunta secondaria: un fallimento qui non deve
    // impedire la visualizzazione della scheda, quindi nessun setError.
    listProgressionEvents(token)
      .then((result) => {
        if (!cancelled) {
          setSuggestions(result);
        }
      })
      .catch(() => {
        /* i suggerimenti sono opzionali: nessun errore bloccante */
      });
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  async function handleDelete(): Promise<void> {
    if (!token || !id) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteWorkout(token, id);
      navigate("/workouts", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile eliminare la scheda.");
      setIsDeleting(false);
    }
  }

  if (error) {
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

  return (
    <main>
      <p>
        <Link to="/workouts">← Le tue schede</Link>
      </p>
      <h1>{workout.name}</h1>
      {workout.notes && <p>{workout.notes}</p>}
      <p>
        <Link to={`/workouts/${workout.id}/log`}>Registra sessione</Link>
      </p>
      <p>
        <Link to={`/workouts/${workout.id}/edit`}>Modifica scheda</Link>
      </p>

      {workout.exercises.map((exercise) => {
        const suggestion = suggestions.find((s) => s.exerciseId === exercise.exerciseId);
        return (
          <section key={exercise.id} className="workout-exercise">
            <h2>{exercise.exerciseName}</h2>
            {exercise.notes && <p>{exercise.notes}</p>}
            {suggestion && <p className="progression-suggestion">{suggestion.reason}</p>}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Peso</th>
                    <th>Recupero</th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.sets.map((set) => (
                    <tr key={set.id}>
                      <td>{set.setNumber}</td>
                      <td>{set.targetReps}</td>
                      <td>
                        {set.targetWeight !== null ? `${set.targetWeight} kg` : "corpo libero"}
                      </td>
                      <td>{set.restSeconds !== null ? `${set.restSeconds}s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {exercise.restSeconds !== null && (
              <p className="workout-exercise__rest">
                Recupero prima del prossimo esercizio: {exercise.restSeconds}s
              </p>
            )}
          </section>
        );
      })}

      <button type="button" className="secondary" onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? "Eliminazione…" : "Elimina scheda"}
      </button>
    </main>
  );
}

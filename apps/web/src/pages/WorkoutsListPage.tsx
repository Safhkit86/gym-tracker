import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { WorkoutSummary } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { listWorkouts } from "../api/workouts";
import { ApiRequestError } from "../api/client";

export function WorkoutsListPage() {
  const { token } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listWorkouts(token)
      .then((result) => {
        if (!cancelled) {
          setWorkouts(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main>
      <h1>Le tue schede</h1>
      <p>
        <Link to="/workouts/new">Nuova scheda</Link>
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {workouts === null && !error && <p>Caricamento…</p>}
      {workouts?.length === 0 && <p>Non hai ancora nessuna scheda.</p>}
      {workouts && workouts.length > 0 && (
        <ul className="workout-list">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link to={`/workouts/${workout.id}`}>{workout.name}</Link>
              <span className="workout-list__meta">
                {" "}
                — {workout.exerciseCount} {workout.exerciseCount === 1 ? "esercizio" : "esercizi"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

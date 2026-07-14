import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { WorkoutDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { deleteWorkout, getWorkout } from "../api/workouts";
import { ApiRequestError } from "../api/client";

export function WorkoutDetailPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
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

      {workout.exercises.map((exercise) => (
        <section key={exercise.id} className="workout-exercise">
          <h2>{exercise.exerciseName}</h2>
          {exercise.notes && <p>{exercise.notes}</p>}
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
                  <td>{set.targetWeight !== null ? `${set.targetWeight} kg` : "corpo libero"}</td>
                  <td>{set.restSeconds !== null ? `${set.restSeconds}s` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <button type="button" className="secondary" onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? "Eliminazione…" : "Elimina scheda"}
      </button>
    </main>
  );
}

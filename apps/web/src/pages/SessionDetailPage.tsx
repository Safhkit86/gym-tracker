import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { SessionDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { deleteSession, getSession } from "../api/sessions";
import { ApiRequestError } from "../api/client";

export function SessionDetailPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!token || !id) {
      return;
    }
    let cancelled = false;
    getSession(token, id)
      .then((result) => {
        if (!cancelled) {
          setSession(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError ? err.message : "Impossibile caricare la sessione."
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
      await deleteSession(token, id);
      navigate("/sessions", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile eliminare la sessione.");
      setIsDeleting(false);
    }
  }

  if (error) {
    return (
      <main>
        <p role="alert" className="form-error">
          {error}
        </p>
        <Link to="/sessions">Torna allo storico</Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main>
        <p>Caricamento…</p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link to="/sessions">← Storico allenamenti</Link>
      </p>
      <h1>
        {session.workoutName} — {new Date(session.performedAt).toLocaleDateString("it-IT")}
      </h1>
      {session.notes && <p>{session.notes}</p>}

      {session.exercises.map((exercise) => (
        <section key={exercise.exerciseId} className="workout-exercise">
          <h2>{exercise.exerciseName}</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Reps</th>
                  <th>Peso</th>
                  <th>RPE</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set) => (
                  <tr key={set.id}>
                    <td>{set.setNumber}</td>
                    <td>{set.actualReps}</td>
                    <td>{set.actualWeight !== null ? `${set.actualWeight} kg` : "corpo libero"}</td>
                    <td>{set.actualRpe ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <button type="button" className="secondary" onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? "Eliminazione…" : "Elimina sessione"}
      </button>
    </main>
  );
}

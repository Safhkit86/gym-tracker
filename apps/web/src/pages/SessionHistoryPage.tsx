import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SessionSummary } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { listSessions } from "../api/sessions";
import { ApiRequestError } from "../api/client";

export function SessionHistoryPage() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listSessions(token)
      .then((result) => {
        if (!cancelled) {
          setSessions(result);
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
      <h1>Storico allenamenti</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {sessions === null && !error && <p>Caricamento…</p>}
      {sessions?.length === 0 && <p>Non hai ancora registrato nessuna sessione.</p>}
      {sessions && sessions.length > 0 && (
        <ul className="workout-list">
          {sessions.map((session) => (
            <li key={session.id} className="card workout-list__item">
              <Link to={`/sessions/${session.id}`}>
                {session.workoutName} — {new Date(session.performedAt).toLocaleDateString("it-IT")}
              </Link>
              <span className="workout-list__meta">
                {session.exerciseCount} {session.exerciseCount === 1 ? "esercizio" : "esercizi"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

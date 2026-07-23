import { Fragment, useEffect, useState } from "react";
import type { SessionDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { deleteSession, listSessions } from "../api/sessions";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { IconButton } from "../components/IconButton";
import { TrashIcon } from "../components/icons";

type SortOrder = "desc" | "asc";

/** Peso mostrato per l'esercizio: quello del primo set, assumendo (come nel
 *  caso tipico di set dritti) lo stesso carico su tutti i set della riga. */
function formatWeight(session: SessionDetail["exercises"][number]): string {
  const weight = session.sets[0]?.actualWeight ?? null;
  return weight !== null ? `${weight} kg` : "corpo libero";
}

/** Numero di settimana per sessione, indipendente dall'ordinamento mostrato:
 *  scorre le sessioni in ordine cronologico e incrementa ogni volta che
 *  ricomincia dalla scheda "1 - ...", cosi' il conteggio resta corretto sia
 *  in ordine crescente che decrescente. */
function computeWeekNumbers(sessions: SessionDetail[]): Map<string, number> {
  const chronological = [...sessions].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  const weekBySessionId = new Map<string, number>();
  let week = 0;
  for (const session of chronological) {
    if (week === 0 || /^1\s*-/.test(session.workoutName)) {
      week++;
    }
    weekBySessionId.set(session.id, week);
  }
  return weekBySessionId;
}

export function SessionHistoryPage() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function handleDelete(): Promise<void> {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!token || !id) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteSession(token, id);
      setSessions((current) => current?.filter((session) => session.id !== id) ?? current);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile eliminare la sessione.");
    } finally {
      setDeletingId(null);
    }
  }

  // Il backend restituisce gia' dal piu' recente: per "asc" basta invertire
  // in locale, senza un'altra chiamata.
  const orderedSessions = sessions && sortOrder === "asc" ? [...sessions].reverse() : sessions;
  const weekBySessionId = sessions ? computeWeekNumbers(sessions) : null;
  // Stesso numero di colonne "Set N" su ogni card (non solo per-sessione):
  // altrimenti Kg/Recupero cadrebbero a un'ascissa diversa da card a card.
  const maxSets = sessions
    ? Math.max(1, ...sessions.flatMap((s) => s.exercises.map((e) => e.sets.length)))
    : 1;

  return (
    <main className="main-wide">
      <h1>Storico allenamenti</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {sessions === null && !error && <p>Caricamento…</p>}
      {sessions?.length === 0 && <p>Non hai ancora registrato nessuna sessione.</p>}

      {orderedSessions && orderedSessions.length > 0 && (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="secondary"
              onClick={() => setSortOrder((current) => (current === "desc" ? "asc" : "desc"))}
            >
              {sortOrder === "desc" ? "↓ Piu' recenti prima" : "↑ Meno recenti prima"}
            </button>
          </div>

          {orderedSessions.map((session, index) => {
            const week = weekBySessionId?.get(session.id);
            const previousWeek =
              index > 0 ? weekBySessionId?.get(orderedSessions[index - 1].id) : undefined;
            const isNewWeek = week !== undefined && week !== previousWeek;
            return (
              <Fragment key={session.id}>
                {isNewWeek && (
                  <div className="session-week-divider">
                    <span>Settimana {week}</span>
                  </div>
                )}
                <section className="card session-card">
                  <div className="session-card__header">
                    <h2>{session.workoutName}</h2>
                    <span className="session-card__date">
                      {new Date(session.performedAt).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                  {session.notes && <p>{session.notes}</p>}

                  <div className="table-scroll">
                    <table>
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
                        {session.exercises.map((exercise) => (
                          <tr key={exercise.exerciseId}>
                            <td>{exercise.exerciseName}</td>
                            {Array.from({ length: maxSets }, (_, i) => (
                              <td key={i}>
                                {exercise.sets[i] ? exercise.sets[i].actualReps : "—"}
                              </td>
                            ))}
                            <td>{formatWeight(exercise)}</td>
                            <td>
                              {exercise.restSeconds !== null ? `${exercise.restSeconds}s` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="session-card__actions">
                    <IconButton
                      onClick={() => setConfirmDeleteId(session.id)}
                      icon={<TrashIcon />}
                      label="Elimina sessione"
                      variant="danger"
                      disabled={deletingId === session.id}
                    />
                  </div>
                </section>
              </Fragment>
            );
          })}
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message="Sei sicuro di voler eliminare questa sessione?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </main>
  );
}

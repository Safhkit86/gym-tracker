import { Fragment, useEffect, useState } from "react";
import type { MeasurementEntry, SessionDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { deleteSession, listSessions } from "../api/sessions";
import { deleteMeasurement, listMeasurements } from "../api/measurements";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { IconButton } from "../components/IconButton";
import { TrashIcon } from "../components/icons";
import { NARROW_TABLE_LAYOUT_QUERY, useIsNarrowViewport } from "../hooks/useIsNarrowViewport";

type SortOrder = "desc" | "asc";
type HistoryTab = "sessions" | "measurements";

const MEASUREMENT_FIELDS = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "chestCm", label: "Petto", unit: "cm" },
  { key: "armCm", label: "Braccia", unit: "cm" },
  { key: "waistCm", label: "Vita", unit: "cm" },
  { key: "legCm", label: "Gamba", unit: "cm" },
] as const;

/** Differenza rispetto alla misurazione successiva (piu' recente): positiva
 *  se il valore e' aumentato nel tempo. Arrotondata a un decimale per evitare
 *  artefatti di virgola mobile (es. 79.1 - 78.4). null se uno dei due valori
 *  manca o non e' cambiato (nessuna freccia da mostrare). */
function computeDelta(current: number | null, next: number | null): number | null {
  if (current === null || next === null) {
    return null;
  }
  const diff = Math.round((next - current) * 10) / 10;
  return diff !== 0 ? diff : null;
}

/** Peso mostrato per l'esercizio: quello del primo set, assumendo (come nel
 *  caso tipico di set dritti) lo stesso carico su tutti i set della riga. */
function formatWeight(session: SessionDetail["exercises"][number]): string {
  const weight = session.sets[0]?.actualWeight ?? null;
  return weight !== null ? `${weight} kg` : "corpo libero";
}

/** Recupero prima di passare all'esercizio successivo (prescritto dalla
 *  scheda al momento del log). */
function formatRestSeconds(exercise: SessionDetail["exercises"][number]): string {
  return exercise.restSeconds !== null ? `${exercise.restSeconds}s` : "—";
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
  const [tab, setTab] = useState<HistoryTab>("sessions");
  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isNarrow = useIsNarrowViewport(NARROW_TABLE_LAYOUT_QUERY);

  const [measurements, setMeasurements] = useState<MeasurementEntry[] | null>(null);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);
  const [confirmDeleteMeasurementId, setConfirmDeleteMeasurementId] = useState<string | null>(null);

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

  // Caricamento lazy: solo quando l'utente apre la vista Misure, non insieme
  // alle sessioni (schede diverse, evita una chiamata inutile al primo giro).
  useEffect(() => {
    if (!token || tab !== "measurements" || measurements !== null) {
      return;
    }
    let cancelled = false;
    listMeasurements(token)
      .then((result) => {
        if (!cancelled) {
          setMeasurements(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMeasurementsError(
            err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, tab, measurements]);

  async function handleDeleteMeasurement(): Promise<void> {
    const id = confirmDeleteMeasurementId;
    setConfirmDeleteMeasurementId(null);
    if (!token || !id) {
      return;
    }
    setDeletingMeasurementId(id);
    try {
      await deleteMeasurement(token, id);
      setMeasurements((current) => current?.filter((entry) => entry.id !== id) ?? current);
    } catch (err) {
      setMeasurementsError(
        err instanceof ApiRequestError ? err.message : "Impossibile eliminare la misurazione."
      );
    } finally {
      setDeletingMeasurementId(null);
    }
  }

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
    <main className="main-wide main-wide-table">
      <h1>Storico</h1>
      <div className="toolbar">
        <button
          type="button"
          className={tab === "sessions" ? undefined : "secondary"}
          onClick={() => setTab("sessions")}
        >
          Sessioni di allenamento
        </button>
        <button
          type="button"
          className={tab === "measurements" ? undefined : "secondary"}
          onClick={() => setTab("measurements")}
        >
          Misure
        </button>
      </div>

      {tab === "sessions" && (
        <>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {sessions === null && !error && <p>Caricamento…</p>}
          {sessions?.length === 0 && <p>Non hai ancora registrato nessuna sessione.</p>}

          {orderedSessions && orderedSessions.length > 0 && (
            <>
              <div className="toolbar toolbar--end">
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
                        <div className="session-card__title">
                          <h2>{session.workoutName}</h2>
                          {session.workoutNotes && (
                            <p className="session-card__notes">{session.workoutNotes}</p>
                          )}
                        </div>
                        <span className="session-card__date">
                          {new Date(session.performedAt).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                      {session.notes && <p className="session-card__notes">{session.notes}</p>}

                      {isNarrow ? (
                        <div className="stack-table">
                          {session.exercises.map((exercise) => (
                            <div className="stack-block" key={exercise.exerciseId}>
                              <h3>{exercise.exerciseName}</h3>
                              {exercise.sets.map((set) => (
                                <div className="stack-row" key={set.id}>
                                  <span className="stack-label">Set {set.setNumber}</span>
                                  <span>{set.actualReps}</span>
                                </div>
                              ))}
                              <div className="stack-row">
                                <span className="stack-label">Kg</span>
                                <span>{formatWeight(exercise)}</span>
                              </div>
                              <div className="stack-row">
                                <span className="stack-label">Recupero</span>
                                <span>{formatRestSeconds(exercise)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
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
                                  <td>{formatRestSeconds(exercise)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

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
        </>
      )}

      {tab === "measurements" && (
        <div className="measurements-view">
          {measurementsError && (
            <p role="alert" className="form-error">
              {measurementsError}
            </p>
          )}
          {measurements === null && !measurementsError && <p>Caricamento…</p>}
          {measurements?.length === 0 && <p>Non hai ancora registrato nessuna misurazione.</p>}

          {measurements && measurements.length > 0 && (
            <>
              <section className="card">
                {measurements.map((entry, index) => {
                  const next = measurements[index - 1] ?? null;
                  return (
                    <div className="measurement-entry" key={entry.id}>
                      <div className="session-card__header">
                        <h3>{new Date(entry.measuredOn).toLocaleDateString("it-IT")}</h3>
                        <IconButton
                          onClick={() => setConfirmDeleteMeasurementId(entry.id)}
                          icon={<TrashIcon />}
                          label="Elimina misurazione"
                          variant="danger"
                          disabled={deletingMeasurementId === entry.id}
                        />
                      </div>
                      <div className="measurement-grid">
                        {MEASUREMENT_FIELDS.map(({ key, label, unit }) => {
                          const value = entry[key];
                          const delta = computeDelta(value, next?.[key] ?? null);
                          return (
                            <div key={key}>
                              <div className="measurement-item__label">{label}</div>
                              <div className="measurement-item__value">
                                {value !== null ? (
                                  <>
                                    {value}
                                    <small>{unit}</small>
                                  </>
                                ) : (
                                  "—"
                                )}
                                {delta !== null && (
                                  <span className={`delta delta--${delta > 0 ? "up" : "down"}`}>
                                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
              <p className="section-note">
                Più recenti prima. La freccia accanto a un valore lo confronta con la misurazione
                successiva più recente.
              </p>
            </>
          )}

          <ConfirmDialog
            open={confirmDeleteMeasurementId !== null}
            message="Sei sicuro di voler eliminare questa misurazione?"
            onConfirm={handleDeleteMeasurement}
            onCancel={() => setConfirmDeleteMeasurementId(null)}
          />
        </div>
      )}
    </main>
  );
}

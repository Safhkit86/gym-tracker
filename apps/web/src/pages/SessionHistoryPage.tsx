import { Fragment, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { MeasurementEntry, Paginated, SessionDetail } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { deleteSession, listSessions, listSessionsPage } from "../api/sessions";
import { deleteMeasurement, listMeasurements, listMeasurementsPage } from "../api/measurements";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { IconButton } from "../components/IconButton";
import { Pagination } from "../components/Pagination";
import { QuickFilterChips } from "../components/QuickFilterChips";
import { DownloadIcon, TrashIcon, UploadIcon } from "../components/icons";
import { NARROW_TABLE_LAYOUT_QUERY, useIsNarrowViewport } from "../hooks/useIsNarrowViewport";
import { MEASUREMENT_FIELDS, computeDelta } from "../utils/measurements";
import { sinceForQuickFilter, type QuickFilterPreset } from "../utils/quick-filters";
import { SessionImportReviewDialog } from "../components/SessionImportReviewDialog";
import {
  analyzeSessionImport,
  buildSessionExportRows,
  downloadCsvFile,
  importSessionsWithResolutions,
  parseSessionImportCsv,
  readFileAsText,
  sessionsFilename,
  toCsvText,
  CsvImportError,
  type MissingWorkoutResolution,
  type SessionImportAnalysis,
} from "../components/session-import-export";
import {
  buildMeasurementExportRows,
  importMeasurementsFromFile,
  measurementsFilename,
  parseMeasurementImportCsv,
  type PortableMeasurement,
} from "../components/measurement-import-export";

type SortOrder = "desc" | "asc";
type HistoryTab = "sessions" | "measurements";

/** Peso mostrato per l'esercizio: quello del primo set, assumendo (come nel
 *  caso tipico di set dritti) lo stesso carico su tutti i set della riga. */
function formatWeight(session: SessionDetail["exercises"][number]): string {
  const weight = session.sets[0]?.actualWeight ?? null;
  return weight !== null ? `${weight} kg` : "corpo libero";
}

/** Recupero effettivo tra le serie, quello inserito dall'utente in Registra
 *  Sessione (SessionSet.actualRestSeconds) — non exercise.restSeconds, che è
 *  solo il valore informativo prescritto dalla scheda (mai modificabile in
 *  Registra Sessione, vedi il commento su ExerciseLogForm lì) e quasi sempre
 *  assente se la scheda non lo specifica esplicitamente. Stesso set preso a
 *  riferimento di formatWeight sopra (il primo), stessa assunzione di
 *  recupero uguale su tutte le serie dell'esercizio. */
function formatRestSeconds(exercise: SessionDetail["exercises"][number]): string {
  const restSeconds = exercise.sets[0]?.actualRestSeconds ?? null;
  return restSeconds !== null ? `${restSeconds}s` : "—";
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

/** Entry cronologicamente precedente (per il calcolo del delta mostrato
 *  accanto a ogni valore): cercata nello storico misure completo, non nella
 *  sola pagina mostrata a schermo — altrimenti la prima entry di ogni
 *  pagina (tranne la prima) perderebbe il confronto con quella immediatamente
 *  precedente, rimasta sulla pagina precedente. */
function findPreviousMeasurement(
  all: MeasurementEntry[],
  current: MeasurementEntry
): MeasurementEntry | null {
  const index = all.findIndex((entry) => entry.id === current.id);
  return index === -1 ? null : (all[index + 1] ?? null);
}

/** Dimensione di pagina per le liste paginate di questa vista (sessioni e
 *  misure): stesso valore del default lato server (DEFAULT_PAGE_SIZE in
 *  @gym-tracker/shared/pagination.ts) copiato qui invece che importato:
 *  un import "value" (non "type") da @gym-tracker/shared trascinerebbe nel
 *  bundle browser l'intero barrel del pacchetto, incluse le dipendenze
 *  solo-Node di altri moduli condivisi (amqplib, nodemailer) — vedi
 *  amqp-connection.ts/mailer.ts, mai usati da apps/web. */
const HISTORY_PAGE_SIZE = 20;

export function SessionHistoryPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<HistoryTab>("sessions");
  // Storico completo, non paginato: serve SOLO per numerare le settimane
  // (richiede l'ordine cronologico intero, non la sola pagina visibile) e
  // per "Esporta storico" (deve restare un CSV con tutta la cronologia,
  // indipendente da pagina/filtro rapido correnti). Le card mostrate a
  // schermo vengono invece da sessionsPage sotto (fetch paginato lato server).
  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [sessionsPage, setSessionsPage] = useState<Paginated<SessionDetail> | null>(null);
  const [page, setPage] = useState(1);
  const [quickFilter, setQuickFilter] = useState<QuickFilterPreset>("all");
  // Forza un refetch della pagina corrente (stessi page/sortOrder/quickFilter)
  // dopo un'importazione: un cambio di stato "vuoto" non farebbe ripartire
  // l'effetto sotto, che dipende solo da page/sortOrder/quickFilter/token.
  const [sessionsRefreshTick, setSessionsRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isNarrow = useIsNarrowViewport(NARROW_TABLE_LAYOUT_QUERY);

  // Stesso schema delle sessioni: measurements e' il totale non paginato
  // (per "Esporta misure"), measurementsPage la fetta mostrata a schermo.
  const [measurements, setMeasurements] = useState<MeasurementEntry[] | null>(null);
  const [measurementsPage, setMeasurementsPage] = useState<Paginated<MeasurementEntry> | null>(
    null
  );
  const [measurementsPageNumber, setMeasurementsPageNumber] = useState(1);
  const [measurementsQuickFilter, setMeasurementsQuickFilter] = useState<QuickFilterPreset>("all");
  const [measurementsRefreshTick, setMeasurementsRefreshTick] = useState(0);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);
  const [confirmDeleteMeasurementId, setConfirmDeleteMeasurementId] = useState<string | null>(null);

  const [isExportingMeasurements, setIsExportingMeasurements] = useState(false);
  const [isImportingMeasurements, setIsImportingMeasurements] = useState(false);
  const [measurementImportResult, setMeasurementImportResult] = useState<string | null>(null);
  // Nessuna pagina di approvazione: a differenza di schede/sessioni non c'è
  // un catalogo da abbinare, solo un conferma/annulla come le schede senza
  // ambiguità.
  const [pendingMeasurementImport, setPendingMeasurementImport] = useState<
    PortableMeasurement[] | null
  >(null);
  const measurementFileInputRef = useRef<HTMLInputElement>(null);

  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  // Import senza schede mancanti: solo un conferma/annulla, come le schede.
  const [pendingSimpleImport, setPendingSimpleImport] = useState<SessionImportAnalysis | null>(
    null
  );
  // Import con almeno una scheda non trovata nel catalogo: pagina di approvazione.
  const [pendingReview, setPendingReview] = useState<SessionImportAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Pagina di sessioni mostrata a schermo (lato server): rifatta ad ogni
  // cambio di pagina/ordinamento/filtro rapido, oltre che dopo un import
  // (sessionsRefreshTick) o un'eliminazione che non richiede di tornare
  // alla pagina precedente (vedi handleDelete).
  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listSessionsPage(token, {
      page,
      pageSize: HISTORY_PAGE_SIZE,
      since: sinceForQuickFilter(quickFilter),
      order: sortOrder,
    })
      .then((result) => {
        if (!cancelled) {
          setSessionsPage(result);
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
  }, [token, page, sortOrder, quickFilter, sessionsRefreshTick]);

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

  // Pagina di misure mostrata a schermo (lato server), stesso schema di
  // sessionsPage sopra: caricata solo quando la vista Misure e' aperta.
  useEffect(() => {
    if (!token || tab !== "measurements") {
      return;
    }
    let cancelled = false;
    listMeasurementsPage(token, {
      page: measurementsPageNumber,
      pageSize: HISTORY_PAGE_SIZE,
      since: sinceForQuickFilter(measurementsQuickFilter),
    })
      .then((result) => {
        if (!cancelled) {
          setMeasurementsPage(result);
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
  }, [token, tab, measurementsPageNumber, measurementsQuickFilter, measurementsRefreshTick]);

  async function handleExportAll(): Promise<void> {
    if (!token || !sessions || sessions.length === 0) {
      return;
    }
    setIsExportingAll(true);
    setError(null);
    try {
      downloadCsvFile(toCsvText(buildSessionExportRows(sessions)), sessionsFilename());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile esportare lo storico.");
    } finally {
      setIsExportingAll(false);
    }
  }

  function handleImportClick(): void {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Azzerato subito: permette di riselezionare lo stesso file (altrimenti
    // il browser non rilancia onChange se il path scelto non cambia).
    event.target.value = "";
    if (!file || !token) {
      return;
    }
    setError(null);
    setImportResult(null);
    try {
      const text = await readFileAsText(file);
      const portableSessions = parseSessionImportCsv(text);
      const analysis = await analyzeSessionImport(token, portableSessions);
      if (analysis.missing.length === 0) {
        setPendingSimpleImport(analysis);
      } else {
        setPendingReview(analysis);
      }
    } catch (err) {
      setError(
        err instanceof CsvImportError
          ? err.message
          : err instanceof ApiRequestError
            ? err.message
            : "Impossibile leggere il file."
      );
    }
  }

  async function runImport(
    analysis: SessionImportAnalysis,
    resolutions: MissingWorkoutResolution[]
  ): Promise<void> {
    if (!token) {
      return;
    }
    setIsImporting(true);
    try {
      const result = await importSessionsWithResolutions(token, analysis, resolutions);
      setSessions(await listSessions(token));
      // Non si torna a pagina 1: la pagina paginata mostrata a schermo viene
      // solo ricaricata sul posto (le sessioni importate possono avere
      // qualunque data, non necessariamente le piu' recenti).
      setSessionsRefreshTick((tick) => tick + 1);
      const parts: string[] = [];
      if (result.createdSessions.length > 0) {
        parts.push(
          `${result.createdSessions.length} ${result.createdSessions.length === 1 ? "sessione importata" : "sessioni importate"}.`
        );
      }
      if (result.createdWorkoutNames.length > 0) {
        parts.push(`Schede create: ${result.createdWorkoutNames.join(", ")}.`);
      }
      if (result.failed.length > 0) {
        parts.push(
          `Non importate: ${result.failed
            .map((f) => `"${f.workoutName}" del ${f.performedAt} (${f.message})`)
            .join(", ")}.`
        );
      }
      setImportResult(parts.join(" ") || "Nessuna sessione importata.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile importare il file.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSimpleImportConfirm(): Promise<void> {
    const analysis = pendingSimpleImport;
    setPendingSimpleImport(null);
    if (!analysis) {
      return;
    }
    await runImport(analysis, []);
  }

  async function handleReviewConfirm(resolutions: MissingWorkoutResolution[]): Promise<void> {
    const analysis = pendingReview;
    setPendingReview(null);
    if (!analysis) {
      return;
    }
    await runImport(analysis, resolutions);
  }

  async function handleExportMeasurements(): Promise<void> {
    if (!token || !measurements || measurements.length === 0) {
      return;
    }
    setIsExportingMeasurements(true);
    setMeasurementsError(null);
    try {
      downloadCsvFile(toCsvText(buildMeasurementExportRows(measurements)), measurementsFilename());
    } catch (err) {
      setMeasurementsError(
        err instanceof ApiRequestError ? err.message : "Impossibile esportare le misure."
      );
    } finally {
      setIsExportingMeasurements(false);
    }
  }

  function handleImportMeasurementsClick(): void {
    measurementFileInputRef.current?.click();
  }

  async function handleMeasurementFileSelected(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    // Azzerato subito: permette di riselezionare lo stesso file (altrimenti
    // il browser non rilancia onChange se il path scelto non cambia).
    event.target.value = "";
    if (!file || !token) {
      return;
    }
    setMeasurementsError(null);
    setMeasurementImportResult(null);
    try {
      const text = await readFileAsText(file);
      setPendingMeasurementImport(parseMeasurementImportCsv(text));
    } catch (err) {
      setMeasurementsError(
        err instanceof CsvImportError
          ? err.message
          : err instanceof ApiRequestError
            ? err.message
            : "Impossibile leggere il file."
      );
    }
  }

  async function handleMeasurementImportConfirm(): Promise<void> {
    const entries = pendingMeasurementImport;
    setPendingMeasurementImport(null);
    if (!token || !entries) {
      return;
    }
    setIsImportingMeasurements(true);
    try {
      const result = await importMeasurementsFromFile(token, entries);
      setMeasurements(await listMeasurements(token));
      setMeasurementsRefreshTick((tick) => tick + 1);
      const parts: string[] = [];
      if (result.imported > 0) {
        parts.push(
          `${result.imported} ${result.imported === 1 ? "misurazione importata" : "misurazioni importate"}.`
        );
      }
      if (result.failed.length > 0) {
        parts.push(
          `Non importate: ${result.failed.map((f) => `${f.measuredOn} (${f.message})`).join(", ")}.`
        );
      }
      setMeasurementImportResult(parts.join(" ") || "Nessuna misurazione importata.");
    } catch (err) {
      setMeasurementsError(
        err instanceof ApiRequestError ? err.message : "Impossibile importare il file."
      );
    } finally {
      setIsImportingMeasurements(false);
    }
  }

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
      // Se era l'unica entry della pagina corrente (e non e' la prima),
      // torna a quella precedente invece di lasciare la vista vuota.
      if (measurementsPage?.items?.length === 1 && measurementsPageNumber > 1) {
        setMeasurementsPageNumber((current) => current - 1);
      } else {
        setMeasurementsRefreshTick((tick) => tick + 1);
      }
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
      // Se era l'unica sessione della pagina corrente (e non e' la prima),
      // torna a quella precedente invece di lasciare la vista vuota con
      // "Successiva" disabilitato.
      if (sessionsPage?.items?.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setSessionsRefreshTick((tick) => tick + 1);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile eliminare la sessione.");
    } finally {
      setDeletingId(null);
    }
  }

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
          <div className="toolbar">
            <IconButton
              onClick={handleImportClick}
              icon={<UploadIcon />}
              label="Importa storico"
              disabled={isImporting}
            />
            <IconButton
              onClick={handleExportAll}
              icon={<DownloadIcon />}
              label="Esporta storico"
              disabled={isExportingAll || !sessions || sessions.length === 0}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="File storico da importare"
            onChange={handleFileSelected}
            hidden
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {importResult && <p role="status">{importResult}</p>}
          {sessions === null && sessionsPage === null && !error && <p>Caricamento…</p>}
          {sessions?.length === 0 && <p>Non hai ancora registrato nessuna sessione.</p>}

          {sessions && sessions.length > 0 && (
            <>
              <div className="toolbar toolbar--end">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSortOrder((current) => (current === "desc" ? "asc" : "desc"));
                    setPage(1);
                  }}
                >
                  {sortOrder === "desc" ? "↓ Piu' recenti prima" : "↑ Meno recenti prima"}
                </button>
              </div>

              <QuickFilterChips
                value={quickFilter}
                onChange={(preset) => {
                  setQuickFilter(preset);
                  setPage(1);
                }}
              />

              {sessionsPage?.items?.length === 0 && (
                <p>Nessuna sessione registrata in questo periodo.</p>
              )}

              {sessionsPage?.items?.map((session, index) => {
                const week = weekBySessionId?.get(session.id);
                const previousWeek =
                  index > 0 ? weekBySessionId?.get(sessionsPage.items[index - 1].id) : undefined;
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

              {sessionsPage && (
                <Pagination
                  page={sessionsPage.page}
                  pageSize={sessionsPage.pageSize}
                  total={sessionsPage.total}
                  onPageChange={setPage}
                />
              )}
            </>
          )}

          <ConfirmDialog
            open={confirmDeleteId !== null}
            message="Sei sicuro di voler eliminare questa sessione?"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDeleteId(null)}
          />

          <ConfirmDialog
            open={pendingSimpleImport !== null}
            message={
              pendingSimpleImport
                ? `Importare ${pendingSimpleImport.resolved.length} ${pendingSimpleImport.resolved.length === 1 ? "sessione" : "sessioni"}? Verranno aggiunte come nuove, senza toccare quelle esistenti.`
                : ""
            }
            onConfirm={handleSimpleImportConfirm}
            onCancel={() => setPendingSimpleImport(null)}
          />

          <SessionImportReviewDialog
            open={pendingReview !== null}
            groups={pendingReview?.missing ?? []}
            existingWorkouts={pendingReview?.existingWorkouts ?? []}
            onConfirm={handleReviewConfirm}
            onCancel={() => setPendingReview(null)}
          />
        </>
      )}

      {tab === "measurements" && (
        <div className="measurements-view">
          <div className="toolbar">
            <IconButton
              onClick={handleImportMeasurementsClick}
              icon={<UploadIcon />}
              label="Importa misure"
              disabled={isImportingMeasurements}
            />
            <IconButton
              onClick={handleExportMeasurements}
              icon={<DownloadIcon />}
              label="Esporta misure"
              disabled={isExportingMeasurements || !measurements || measurements.length === 0}
            />
          </div>
          <input
            ref={measurementFileInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="File misure da importare"
            onChange={handleMeasurementFileSelected}
            hidden
          />
          {measurementsError && (
            <p role="alert" className="form-error">
              {measurementsError}
            </p>
          )}
          {measurementImportResult && <p role="status">{measurementImportResult}</p>}
          {measurements === null && measurementsPage === null && !measurementsError && (
            <p>Caricamento…</p>
          )}
          {measurements?.length === 0 && <p>Non hai ancora registrato nessuna misurazione.</p>}

          {measurements && measurements.length > 0 && (
            <>
              <QuickFilterChips
                value={measurementsQuickFilter}
                onChange={(preset) => {
                  setMeasurementsQuickFilter(preset);
                  setMeasurementsPageNumber(1);
                }}
              />

              {measurementsPage?.items?.length === 0 && (
                <p>Nessuna misurazione registrata in questo periodo.</p>
              )}

              <section className="card">
                {measurementsPage?.items?.map((entry) => {
                  // La misurazione precedente e' quella cronologicamente
                  // prima (indice successivo, l'array e' piu' recenti
                  // prima): la freccia va sulla misurazione nuova, non su
                  // quella vecchia.
                  const previous = measurements
                    ? findPreviousMeasurement(measurements, entry)
                    : null;
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
                          const delta = computeDelta(previous?.[key] ?? null, value);
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
                precedente.
              </p>

              {measurementsPage && (
                <Pagination
                  page={measurementsPage.page}
                  pageSize={measurementsPage.pageSize}
                  total={measurementsPage.total}
                  onPageChange={setMeasurementsPageNumber}
                />
              )}
            </>
          )}

          <ConfirmDialog
            open={confirmDeleteMeasurementId !== null}
            message="Sei sicuro di voler eliminare questa misurazione?"
            onConfirm={handleDeleteMeasurement}
            onCancel={() => setConfirmDeleteMeasurementId(null)}
          />

          <ConfirmDialog
            open={pendingMeasurementImport !== null}
            message={
              pendingMeasurementImport
                ? `Importare ${pendingMeasurementImport.length} ${pendingMeasurementImport.length === 1 ? "misurazione" : "misurazioni"}? Le date già presenti verranno aggiornate con i nuovi valori, le altre aggiunte come nuove.`
                : ""
            }
            onConfirm={handleMeasurementImportConfirm}
            onCancel={() => setPendingMeasurementImport(null)}
          />
        </div>
      )}
    </main>
  );
}

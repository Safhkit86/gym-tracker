import type {
  Exercise,
  SessionDetail,
  SessionInput,
  WorkoutInput,
  WorkoutSummary,
} from "@gym-tracker/shared";
import { ApiRequestError } from "../api/client";
import { listExercises } from "../api/exercises";
import { logSession } from "../api/sessions";
import { createWorkout, listWorkouts } from "../api/workouts";
import {
  CsvImportError,
  buildCsvText,
  downloadCsvFile,
  parseCsvRows,
  parseOptionalNumber,
  readFileAsText,
  todayIsoDate,
} from "../utils/csv";
import { buildExerciseCache, resolveExerciseId } from "../utils/resolve-exercise";

export { downloadCsvFile, readFileAsText, buildCsvText as toCsvText, CsvImportError };

/**
 * Formato del file di export/import dello storico sessioni: stesso principio
 * del CSV delle schede (vedi components/workout-import-export.ts) — una
 * riga per SET, separatore ";", BOM UTF-8 — ma con le colonne di una
 * sessione REGISTRATA (valori effettivi: ripetizioni fatte, peso usato,
 * RPE), non di una scheda prescritta. Nessuna colonna "obiettivo"
 * (rep_min/rep_max ecc.): scelta dell'utente per tenere il file più
 * semplice — quando una scheda va ricostruita perché il suo nome non è nel
 * catalogo (vedi sotto), i valori effettivi diventano anche l'obiettivo
 * proposto per la nuova scheda.
 *
 * `id_sessione` è opzionale e serve solo a distinguere due sessioni con la
 * stessa scheda nello stesso giorno (raro ma possibile): un export lo
 * valorizza con l'id reale della sessione, per un import scritto a mano
 * basta lasciarlo vuoto — le righe si raggruppano comunque per
 * scheda+data, tranne quando serve davvero distinguere due sessioni sulla
 * stessa scheda/data, nel qual caso un valore qualsiasi (es. "1"/"2") basta.
 */
export const SESSION_CSV_COLUMNS = [
  "id_sessione",
  "scheda",
  "data",
  "note_sessione",
  "esercizio",
  "posizione",
  "recupero_dopo_esercizio_sec",
  "incremento_progressione",
  "set",
  "rep_fatte",
  "peso_kg",
  "rpe",
  "recupero_effettivo_sec",
] as const;

const REQUIRED_SESSION_COLUMNS = ["scheda", "data", "esercizio", "posizione", "set"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PortableSessionSet {
  setNumber: number;
  actualReps: number;
  actualWeight: number | null;
  actualRpe: number | null;
  actualRestSeconds: number | null;
}

export interface PortableSessionExercise {
  exerciseName: string;
  position: number;
  restSeconds: number | null;
  progressionIncrement: number | null;
  sets: PortableSessionSet[];
}

export interface PortableSession {
  workoutName: string;
  /** YYYY-MM-DD: lo storico in questa app non tiene un orario, solo la data
   *  (vedi LogSessionPage, che raccoglie solo un <input type="date">). */
  performedAt: string;
  notes: string | null;
  exercises: PortableSessionExercise[];
}

// --- Export ---

function numberOrEmpty(value: number | null): string {
  return value === null ? "" : String(value);
}

/** Righe CSV (inclusa l'intestazione) per una o più sessioni: una riga per
 *  ogni set. `posizione` è l'ordine dell'esercizio così come restituito
 *  dall'API (le sessioni non hanno un campo posizione salvato: è derivato
 *  dall'indice nell'array, non un dato di dominio). */
export function buildSessionExportRows(sessions: SessionDetail[]): string[][] {
  const rows: string[][] = [[...SESSION_CSV_COLUMNS]];
  for (const session of sessions) {
    session.exercises.forEach((exercise, exerciseIndex) => {
      const sortedSets = [...exercise.sets].sort((a, b) => a.setNumber - b.setNumber);
      for (const set of sortedSets) {
        rows.push([
          session.id,
          session.workoutName,
          session.performedAt.slice(0, 10),
          session.notes ?? "",
          exercise.exerciseName,
          String(exerciseIndex + 1),
          numberOrEmpty(exercise.restSeconds),
          numberOrEmpty(exercise.progressionIncrement),
          String(set.setNumber),
          String(set.actualReps),
          numberOrEmpty(set.actualWeight),
          numberOrEmpty(set.actualRpe),
          numberOrEmpty(set.actualRestSeconds),
        ]);
      }
    });
  }
  return rows;
}

export function sessionsFilename(): string {
  return `gym-tracker-storico-${todayIsoDate()}.csv`;
}

// --- Import: parsing ---

/** Valida e trasforma il CSV in sessioni annidate (sessione->esercizi->set).
 *  Validazione solo strutturale (colonne obbligatorie presenti, valori
 *  strutturali — scheda/data/esercizio/posizione/set/rep_fatte — non vuoti,
 *  numeri ben formati): le regole di business restano al server. */
export function parseSessionImportCsv(text: string): PortableSession[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new CsvImportError("Il file è vuoto.");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const indexOf = new Map(header.map((h, i) => [h, i]));
  const missing = REQUIRED_SESSION_COLUMNS.filter((c) => !indexOf.has(c));
  if (missing.length > 0) {
    throw new CsvImportError(`Mancano le colonne obbligatorie: ${missing.join(", ")}.`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    throw new CsvImportError("Il file non contiene nessuna riga di dati.");
  }

  function cell(row: string[], name: string): string {
    const index = indexOf.get(name);
    return index === undefined ? "" : (row[index] ?? "").trim();
  }

  const sessions: PortableSession[] = [];
  const sessionByKey = new Map<string, PortableSession>();
  // Chiave = id_sessione (se presente) + scheda + data: vedi commento del
  // formato sopra sul perché id_sessione esiste.
  const exerciseByKey = new Map<string, PortableSessionExercise>();

  dataRows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 per l'intestazione, +1 perche' 1-based
    const workoutName = cell(row, "scheda");
    const dateRaw = cell(row, "data");
    const exerciseName = cell(row, "esercizio");
    if (!workoutName) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "scheda" è vuota.`);
    }
    if (!dateRaw) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "data" è vuota.`);
    }
    if (!DATE_PATTERN.test(dateRaw) || Number.isNaN(Date.parse(dateRaw))) {
      throw new CsvImportError(
        `Riga ${rowNumber}: la colonna "data" deve essere in formato AAAA-MM-GG (es. 2026-01-31), non "${dateRaw}".`
      );
    }
    if (!exerciseName) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "esercizio" è vuota.`);
    }
    const position = parseOptionalNumber(cell(row, "posizione"), rowNumber, "posizione");
    if (position === null) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "posizione" è vuota.`);
    }
    const setNumber = parseOptionalNumber(cell(row, "set"), rowNumber, "set");
    if (setNumber === null) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "set" è vuota.`);
    }
    const actualReps = parseOptionalNumber(cell(row, "rep_fatte"), rowNumber, "rep_fatte");
    if (actualReps === null) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "rep_fatte" è vuota.`);
    }

    const sessionKey = `${cell(row, "id_sessione")} ${workoutName} ${dateRaw}`;
    let session = sessionByKey.get(sessionKey);
    if (!session) {
      session = {
        workoutName,
        performedAt: dateRaw,
        notes: cell(row, "note_sessione") || null,
        exercises: [],
      };
      sessionByKey.set(sessionKey, session);
      sessions.push(session);
    }

    const exerciseKey = `${sessionKey} ${position}`;
    let exercise = exerciseByKey.get(exerciseKey);
    if (!exercise) {
      exercise = {
        exerciseName,
        position,
        restSeconds: parseOptionalNumber(
          cell(row, "recupero_dopo_esercizio_sec"),
          rowNumber,
          "recupero_dopo_esercizio_sec"
        ),
        progressionIncrement: parseOptionalNumber(
          cell(row, "incremento_progressione"),
          rowNumber,
          "incremento_progressione"
        ),
        sets: [],
      };
      exerciseByKey.set(exerciseKey, exercise);
      session.exercises.push(exercise);
    }

    exercise.sets.push({
      setNumber,
      actualReps,
      actualWeight: parseOptionalNumber(cell(row, "peso_kg"), rowNumber, "peso_kg"),
      actualRpe: parseOptionalNumber(cell(row, "rpe"), rowNumber, "rpe"),
      actualRestSeconds: parseOptionalNumber(
        cell(row, "recupero_effettivo_sec"),
        rowNumber,
        "recupero_effettivo_sec"
      ),
    });
  });

  return sessions;
}

// --- Import: risoluzione della scheda di ogni sessione ---

/** Una scheda citata nel file che non esiste (per nome) nel catalogo di chi
 *  importa: raggruppa tutte le sessioni che la citano, cosi' la scelta
 *  dell'utente nella pagina di approvazione (crea/rinomina/abbina/scarta)
 *  si applica una volta sola invece che sessione per sessione. */
export interface MissingWorkoutGroup {
  /** Nome cosi' come appare la prima volta nel file (maiuscole/minuscole originali). */
  proposedName: string;
  sessions: PortableSession[];
  /** Anteprima della struttura che verrebbe creata: dalla sessione più
   *  recente tra quelle del gruppo (la versione presumibilmente più
   *  rappresentativa di cosa quella scheda è oggi). */
  preview: Array<{ exerciseName: string; setCount: number }>;
}

export interface SessionImportAnalysis {
  /** Sessioni la cui scheda esiste già (per nome) nel catalogo. */
  resolved: Array<{ session: PortableSession; workoutId: string }>;
  /** Schede citate nel file ma non trovate: richiedono una decisione
   *  dell'utente prima di poter importare le sessioni che le citano. */
  missing: MissingWorkoutGroup[];
  /** Le schede di chi importa al momento dell'analisi: la pagina di
   *  approvazione le usa per l'opzione "abbina a scheda esistente" (già
   *  disponibili qui, evita una seconda chiamata identica dalla UI). */
  existingWorkouts: WorkoutSummary[];
}

function templateSessionOf(sessions: PortableSession[]): PortableSession {
  return [...sessions].sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
}

/** Divide le sessioni del file in "risolte" (scheda già nel catalogo,
 *  pronte per l'import) e "mancanti" (raggruppate per nome scheda, in
 *  attesa di approvazione). Non crea/modifica nulla: solo analisi. */
export async function analyzeSessionImport(
  token: string,
  sessions: PortableSession[]
): Promise<SessionImportAnalysis> {
  const workouts = await listWorkouts(token);
  const workoutByName = new Map<string, WorkoutSummary>(
    workouts.map((w) => [w.name.trim().toLowerCase(), w])
  );

  const resolved: SessionImportAnalysis["resolved"] = [];
  const missingByKey = new Map<string, PortableSession[]>();
  const firstNameByKey = new Map<string, string>();

  for (const session of sessions) {
    const key = session.workoutName.trim().toLowerCase();
    const match = workoutByName.get(key);
    if (match) {
      resolved.push({ session, workoutId: match.id });
      continue;
    }
    const list = missingByKey.get(key) ?? [];
    list.push(session);
    missingByKey.set(key, list);
    if (!firstNameByKey.has(key)) {
      firstNameByKey.set(key, session.workoutName);
    }
  }

  const missing: MissingWorkoutGroup[] = [...missingByKey.entries()].map(
    ([key, groupSessions]) => ({
      proposedName: firstNameByKey.get(key) as string,
      sessions: groupSessions,
      preview: templateSessionOf(groupSessions).exercises.map((e) => ({
        exerciseName: e.exerciseName,
        setCount: e.sets.length,
      })),
    })
  );

  return { resolved, missing, existingWorkouts: workouts };
}

// --- Import: creazione schede mancanti + registrazione sessioni ---

/** Come l'utente ha deciso di risolvere una scheda mancante (vedi
 *  MissingWorkoutGroup), scelto nella pagina di approvazione. */
export type MissingWorkoutResolution =
  { action: "create"; name: string } | { action: "map"; workoutId: string } | { action: "skip" };

function portableSessionToWorkoutInput(
  session: PortableSession,
  name: string,
  exerciseIds: Map<string, string>
): WorkoutInput {
  return {
    name,
    exercises: [...session.exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        exerciseId: exerciseIds.get(exercise.exerciseName.trim().toLowerCase()) as string,
        position: exercise.position,
        restSeconds: exercise.restSeconds ?? undefined,
        progressionIncrement: exercise.progressionIncrement ?? undefined,
        sets: exercise.sets.map((set) => ({
          setNumber: set.setNumber,
          targetMinReps: set.actualReps,
          targetWeight: set.actualWeight ?? undefined,
          restMinSeconds: set.actualRestSeconds ?? undefined,
          isMaxEffort: false,
        })),
      })),
  };
}

function portableSessionToSessionInput(
  session: PortableSession,
  workoutId: string,
  workoutName: string,
  exercises: Map<string, Exercise>
): SessionInput {
  return {
    workoutId,
    workoutName,
    performedAt: new Date(session.performedAt).toISOString(),
    notes: session.notes ?? undefined,
    exercises: [...session.exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => {
        // Nome REALE del catalogo (non quello nel file, che puo' differire
        // solo per maiuscole/minuscole — es. "Ab Wheel" nel file, "AB Wheel"
        // nel catalogo): stesso motivo del fix su workoutName qui sopra,
        // altrimenti lo stesso esercizio finirebbe salvato con grafie
        // diverse su sessioni diverse.
        const matched = exercises.get(exercise.exerciseName.trim().toLowerCase());
        return {
          exerciseId: matched?.id as string,
          exerciseName: matched?.name ?? exercise.exerciseName,
          progressionIncrement: exercise.progressionIncrement ?? undefined,
          restSeconds: exercise.restSeconds ?? undefined,
          sets: [...exercise.sets]
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((set) => ({
              setNumber: set.setNumber,
              actualReps: set.actualReps,
              actualWeight: set.actualWeight ?? undefined,
              actualRpe: set.actualRpe ?? undefined,
              actualRestSeconds: set.actualRestSeconds ?? undefined,
            })),
        };
      }),
  };
}

export interface SessionImportResult {
  createdSessions: SessionDetail[];
  createdWorkoutNames: string[];
  failed: Array<{ workoutName: string; performedAt: string; message: string }>;
}

/** Applica le risoluzioni decise per le schede mancanti (una per gruppo di
 *  MissingWorkoutGroup, nello stesso ordine di `analysis.missing`), poi
 *  registra tutte le sessioni (quelle già risolte in analisi + quelle appena
 *  risolte). Sequenziale e tollerante ai fallimenti come l'import delle
 *  schede: un errore su una sessione non blocca le altre. */
export async function importSessionsWithResolutions(
  token: string,
  analysis: SessionImportAnalysis,
  resolutions: MissingWorkoutResolution[]
): Promise<SessionImportResult> {
  const catalog = await listExercises(token);
  const exerciseCache = buildExerciseCache(catalog);

  const createdWorkoutNames: string[] = [];
  const failed: SessionImportResult["failed"] = [];
  // (sessione, workoutId, nome scheda al momento del log) da registrare.
  const toLog: Array<{ session: PortableSession; workoutId: string; workoutName: string }> = [];

  for (const item of analysis.resolved) {
    toLog.push({
      session: item.session,
      workoutId: item.workoutId,
      workoutName: item.session.workoutName,
    });
  }

  for (const [index, group] of analysis.missing.entries()) {
    const resolution = resolutions[index];
    if (!resolution || resolution.action === "skip") {
      for (const session of group.sessions) {
        failed.push({
          workoutName: group.proposedName,
          performedAt: session.performedAt,
          message: "Scheda non creata (saltata).",
        });
      }
      continue;
    }

    if (resolution.action === "map") {
      // Il nome della scheda scelta (non quello nel file, spesso diverso —
      // e' proprio per questo che chi importa ha dovuto abbinarla a mano):
      // altrimenti la sessione salverebbe uno snapshot del nome sbagliato,
      // che poi la UI (es. il divisore di settimana in Storico, basato sul
      // nome scheda) userebbe per sempre.
      const targetWorkout = analysis.existingWorkouts.find((w) => w.id === resolution.workoutId);
      const workoutName = targetWorkout?.name ?? group.proposedName;
      for (const session of group.sessions) {
        toLog.push({ session, workoutId: resolution.workoutId, workoutName });
      }
      continue;
    }

    // resolution.action === "create"
    try {
      const template = templateSessionOf(group.sessions);
      const exerciseIds = new Map<string, string>();
      for (const exercise of template.exercises) {
        const id = await resolveExerciseId(token, exercise.exerciseName, null, exerciseCache);
        exerciseIds.set(exercise.exerciseName.trim().toLowerCase(), id);
      }
      const created = await createWorkout(
        token,
        portableSessionToWorkoutInput(template, resolution.name, exerciseIds)
      );
      createdWorkoutNames.push(created.name);
      for (const session of group.sessions) {
        toLog.push({ session, workoutId: created.id, workoutName: created.name });
      }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Errore imprevisto.";
      for (const session of group.sessions) {
        failed.push({ workoutName: group.proposedName, performedAt: session.performedAt, message });
      }
    }
  }

  const createdSessions: SessionDetail[] = [];
  for (const { session, workoutId, workoutName } of toLog) {
    try {
      // resolveExerciseId aggiorna exerciseCache (creando l'esercizio se
      // serve): dopo il ciclo, ogni esercizio della sessione ha una entry
      // nella cache, usata sotto per l'id E il nome REALE del catalogo.
      for (const exercise of session.exercises) {
        await resolveExerciseId(token, exercise.exerciseName, null, exerciseCache);
      }
      const result = await logSession(
        token,
        portableSessionToSessionInput(session, workoutId, workoutName, exerciseCache)
      );
      createdSessions.push(result);
    } catch (err) {
      failed.push({
        workoutName: session.workoutName,
        performedAt: session.performedAt,
        message: err instanceof ApiRequestError ? err.message : "Errore imprevisto.",
      });
    }
  }

  return { createdSessions, createdWorkoutNames, failed };
}

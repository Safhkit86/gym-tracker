import type { Exercise, WorkoutDetail, WorkoutInput } from "@gym-tracker/shared";
import { ApiRequestError } from "../api/client";
import { createExercise, listExercises } from "../api/exercises";
import { createWorkout } from "../api/workouts";

/**
 * Formato del file di export/import delle schede: CSV con una riga per SET
 * (scheda ed esercizio ripetuti su ogni riga del loro esercizio) — un JSON
 * annidato rappresenterebbe la gerarchia scheda->esercizi->set in modo piu'
 * pulito, ma e' scomodo da scrivere/modificare a mano; il CSV si apre e si
 * edita direttamente in Excel/Google Sheets/Numbers. Separatore ";" (non
 * ","): con la virgola come separatore decimale (locale italiana), Excel usa
 * ";" come separatore di lista ed e' quello che si aspetta aprendo il file
 * per doppio click — con "," aprirebbe tutto il contenuto in un'unica
 * colonna. Gli esercizi sono referenziati per NOME, non per id: gli id del
 * catalogo sono generati dal database e non sono portabili tra account/
 * ambienti diversi, mentre il nome resta stabile. In import, un nome non
 * trovato nel catalogo di chi importa crea un nuovo esercizio personale con
 * quel nome (e gruppo muscolare, se presente nel file).
 */
export const CSV_COLUMNS = [
  "scheda",
  "note_scheda",
  "esercizio",
  "gruppo_muscolare",
  "posizione",
  "note_esercizio",
  "recupero_dopo_esercizio_sec",
  "incremento_progressione",
  "set",
  "rep_min",
  "rep_max",
  "peso_kg",
  "recupero_min_sec",
  "recupero_max_sec",
  "sforzo_massimo",
] as const;

/** Colonne senza le quali una riga non e' collocabile nella gerarchia
 *  scheda->esercizio->set: tutte le altre sono opzionali (cella vuota = null). */
const REQUIRED_COLUMNS = ["scheda", "esercizio", "posizione", "set"] as const;

/** Valori riconosciuti come "vero" per la colonna sforzo_massimo, oltre a
 *  true/1: pensati per chi compila il file a mano in italiano. */
const TRUE_VALUES = new Set(["true", "1", "si", "sì", "vero", "x"]);

export interface PortableSet {
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  targetWeight: number | null;
  restMinSeconds: number | null;
  restMaxSeconds: number | null;
  isMaxEffort: boolean;
}

export interface PortableExercise {
  exerciseName: string;
  /** Usato solo se in import il nome non e' trovato nel catalogo di chi
   *  importa, per impostarlo sul nuovo esercizio creato al volo. */
  muscleGroup: string | null;
  position: number;
  notes: string | null;
  restSeconds: number | null;
  progressionIncrement: number | null;
  sets: PortableSet[];
}

export interface PortableWorkout {
  name: string;
  notes: string | null;
  exercises: PortableExercise[];
}

/** Errore di parsing/validazione di un file di import: messaggio gia'
 *  pronto per l'utente, mai i dettagli tecnici del parse CSV. */
export class WorkoutImportFileError extends Error {}

// --- Export ---

function exerciseMuscleGroup(exerciseId: string, catalog: Exercise[]): string | null {
  return catalog.find((e) => e.id === exerciseId)?.muscleGroup ?? null;
}

/** Converte una scheda gia' caricata (dettaglio completo) nella forma
 *  intermedia annidata: esercizi per nome invece che per id, cosi' il file
 *  resta importabile su un account/ambiente diverso da quello di export.
 *  `catalog` serve solo a recuperare il muscleGroup di ogni esercizio (non
 *  presente su WorkoutExercise, che ha gia' solo id+nome). */
export function workoutDetailToPortable(
  workout: WorkoutDetail,
  catalog: Exercise[]
): PortableWorkout {
  return {
    name: workout.name,
    notes: workout.notes,
    exercises: [...workout.exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        exerciseName: exercise.exerciseName,
        muscleGroup: exerciseMuscleGroup(exercise.exerciseId, catalog),
        position: exercise.position,
        notes: exercise.notes,
        restSeconds: exercise.restSeconds,
        progressionIncrement: exercise.progressionIncrement,
        sets: [...exercise.sets]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((set) => ({
            setNumber: set.setNumber,
            targetMinReps: set.targetMinReps,
            targetMaxReps: set.targetMaxReps,
            targetWeight: set.targetWeight,
            restMinSeconds: set.restMinSeconds,
            restMaxSeconds: set.restMaxSeconds,
            isMaxEffort: set.isMaxEffort,
          })),
      })),
  };
}

function numberOrEmpty(value: number | null): string {
  return value === null ? "" : String(value);
}

/** Righe CSV (inclusa l'intestazione) per una o piu' schede: una riga per
 *  ogni set, con scheda/esercizio ripetuti sulle righe dei loro set. */
export function buildExportRows(workouts: WorkoutDetail[], catalog: Exercise[]): string[][] {
  const rows: string[][] = [[...CSV_COLUMNS]];
  for (const workout of workouts) {
    const portable = workoutDetailToPortable(workout, catalog);
    for (const exercise of portable.exercises) {
      for (const set of exercise.sets) {
        rows.push([
          portable.name,
          portable.notes ?? "",
          exercise.exerciseName,
          exercise.muscleGroup ?? "",
          String(exercise.position),
          exercise.notes ?? "",
          numberOrEmpty(exercise.restSeconds),
          numberOrEmpty(exercise.progressionIncrement),
          String(set.setNumber),
          numberOrEmpty(set.targetMinReps),
          numberOrEmpty(set.targetMaxReps),
          numberOrEmpty(set.targetWeight),
          numberOrEmpty(set.restMinSeconds),
          numberOrEmpty(set.restMaxSeconds),
          set.isMaxEffort ? "true" : "",
        ]);
      }
    }
  }
  return rows;
}

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serializza le righe in testo CSV: separatore ";", terminatore di riga
 *  CRLF (lo standard del formato) e un BOM UTF-8 in testa — senza, Excel su
 *  Windows spesso interpreta un CSV UTF-8 come ANSI e mostra le lettere
 *  accentate (à, è, ì, ò, ù) come caratteri corrotti. */
export function toCsvText(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvField).join(";")).join("\r\n")}\r\n`;
}

/** Slug da usare nel nome del file scaricato: minuscolo, solo lettere/numeri/trattini. */
function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove gli accenti (es. "è" -> "e"), scomposti da normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "scheda";
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function singleWorkoutFilename(name: string): string {
  return `gym-tracker-${slugify(name)}-${todayIsoDate()}.csv`;
}

export function planFilename(): string {
  return `gym-tracker-piano-${todayIsoDate()}.csv`;
}

/** Avvia il download del file nel browser: nessun round-trip di rete, solo
 *  un Blob locale scaricato via un link temporaneo (mai aggiunto al DOM). */
export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Import ---

/** Legge il contenuto testuale di un file scelto dall'utente. FileReader
 *  invece del piu' diretto `File.prototype.text()`: quest'ultimo non e'
 *  implementato da jsdom (l'ambiente dei test), FileReader si'. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Impossibile leggere il file."));
    reader.readAsText(file);
  });
}

/** Parser CSV minimale (RFC 4180): supporta separatore ";", campi tra
 *  virgolette con "" per la virgoletta letterale e campi multilinea,
 *  terminatori di riga sia CRLF che LF. Righe completamente vuote scartate. */
function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += char;
        i += 1;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ";") {
      row.push(field);
      field = "";
      i += 1;
    } else if (char === "\r") {
      i += 1;
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Tollera la virgola come separatore decimale (locale italiana, comune
 *  editando a mano in Excel: "82,5") oltre al punto. Cella vuota = null. */
function parseOptionalNumber(raw: string, rowNumber: number, column: string): number | null {
  if (raw === "") {
    return null;
  }
  const value = Number(raw.replace(",", "."));
  if (Number.isNaN(value)) {
    throw new WorkoutImportFileError(
      `Riga ${rowNumber}: la colonna "${column}" non è un numero valido ("${raw}").`
    );
  }
  return value;
}

function parseBoolean(raw: string): boolean {
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

/** Valida e trasforma il CSV in schede annidate (scheda->esercizi->set),
 *  raggruppando le righe per nome scheda e per (scheda, posizione esercizio).
 *  Validazione solo strutturale (colonne obbligatorie presenti, numeri ben
 *  formati): le regole di business (es. rep minime obbligatorie a meno di
 *  sforzo massimo) restano al server, che le applica gia' su ogni
 *  POST /workouts — duplicarle qui produrrebbe due fonti di verita'. */
export function parseWorkoutImportCsv(text: string): PortableWorkout[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new WorkoutImportFileError("Il file è vuoto.");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const indexOf = new Map(header.map((h, i) => [h, i]));
  const missing = REQUIRED_COLUMNS.filter((c) => !indexOf.has(c));
  if (missing.length > 0) {
    throw new WorkoutImportFileError(`Mancano le colonne obbligatorie: ${missing.join(", ")}.`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    throw new WorkoutImportFileError("Il file non contiene nessuna riga di dati.");
  }

  function cell(row: string[], name: string): string {
    const index = indexOf.get(name);
    return index === undefined ? "" : (row[index] ?? "").trim();
  }

  const workouts: PortableWorkout[] = [];
  const workoutByName = new Map<string, PortableWorkout>();
  // Chiave = nome scheda + posizione esercizio: righe con la stessa chiave
  // sono set diversi dello stesso esercizio (vedi commento del formato sopra).
  const exerciseByKey = new Map<string, PortableExercise>();

  dataRows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 per l'intestazione, +1 perche' 1-based
    const workoutName = cell(row, "scheda");
    const exerciseName = cell(row, "esercizio");
    if (!workoutName) {
      throw new WorkoutImportFileError(`Riga ${rowNumber}: la colonna "scheda" è vuota.`);
    }
    if (!exerciseName) {
      throw new WorkoutImportFileError(`Riga ${rowNumber}: la colonna "esercizio" è vuota.`);
    }
    const position = parseOptionalNumber(cell(row, "posizione"), rowNumber, "posizione");
    if (position === null) {
      throw new WorkoutImportFileError(`Riga ${rowNumber}: la colonna "posizione" è vuota.`);
    }
    const setNumber = parseOptionalNumber(cell(row, "set"), rowNumber, "set");
    if (setNumber === null) {
      throw new WorkoutImportFileError(`Riga ${rowNumber}: la colonna "set" è vuota.`);
    }

    let workout = workoutByName.get(workoutName);
    if (!workout) {
      workout = { name: workoutName, notes: cell(row, "note_scheda") || null, exercises: [] };
      workoutByName.set(workoutName, workout);
      workouts.push(workout);
    }

    const exerciseKey = `${workoutName} ${position}`;
    let exercise = exerciseByKey.get(exerciseKey);
    if (!exercise) {
      exercise = {
        exerciseName,
        muscleGroup: cell(row, "gruppo_muscolare") || null,
        position,
        notes: cell(row, "note_esercizio") || null,
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
      workout.exercises.push(exercise);
    }

    exercise.sets.push({
      setNumber,
      targetMinReps: parseOptionalNumber(cell(row, "rep_min"), rowNumber, "rep_min"),
      targetMaxReps: parseOptionalNumber(cell(row, "rep_max"), rowNumber, "rep_max"),
      targetWeight: parseOptionalNumber(cell(row, "peso_kg"), rowNumber, "peso_kg"),
      restMinSeconds: parseOptionalNumber(
        cell(row, "recupero_min_sec"),
        rowNumber,
        "recupero_min_sec"
      ),
      restMaxSeconds: parseOptionalNumber(
        cell(row, "recupero_max_sec"),
        rowNumber,
        "recupero_max_sec"
      ),
      isMaxEffort: parseBoolean(cell(row, "sforzo_massimo")),
    });
  });

  return workouts;
}

export interface ImportResult {
  created: WorkoutDetail[];
  failed: Array<{ name: string; message: string }>;
}

/** Risolve un nome esercizio in un id del catalogo di chi importa: match
 *  per nome case-insensitive; se non trovato, crea un nuovo esercizio
 *  personale con quel nome (e muscleGroup, se presente). `cache` viene
 *  aggiornata cosi' due schede nello stesso file che citano lo stesso
 *  esercizio non ancora esistente non ne creano due copie. Sequenziale
 *  (non Promise.all) apposta: evita che lo stesso nome nuovo, ripetuto due
 *  volte nella stessa scheda, venga creato due volte per una corsa sulla
 *  cache condivisa. */
async function resolveExerciseId(
  token: string,
  exercise: PortableExercise,
  cache: Map<string, Exercise>
): Promise<string> {
  const key = exercise.exerciseName.trim().toLowerCase();
  const existing = cache.get(key);
  if (existing) {
    return existing.id;
  }
  const created = await createExercise(token, {
    name: exercise.exerciseName.trim(),
    muscleGroup: exercise.muscleGroup ?? undefined,
  });
  cache.set(key, created);
  return created.id;
}

function toWorkoutInput(portable: PortableWorkout, exerciseIds: string[]): WorkoutInput {
  return {
    name: portable.name,
    notes: portable.notes ?? undefined,
    exercises: portable.exercises.map((exercise, index) => ({
      exerciseId: exerciseIds[index],
      position: exercise.position,
      notes: exercise.notes ?? undefined,
      restSeconds: exercise.restSeconds ?? undefined,
      progressionIncrement: exercise.progressionIncrement ?? undefined,
      sets: exercise.sets.map((set) => ({
        setNumber: set.setNumber,
        targetMinReps: set.targetMinReps ?? undefined,
        targetMaxReps: set.targetMaxReps ?? undefined,
        targetWeight: set.targetWeight ?? undefined,
        restMinSeconds: set.restMinSeconds ?? undefined,
        restMaxSeconds: set.restMaxSeconds ?? undefined,
        isMaxEffort: set.isMaxEffort,
      })),
    })),
  };
}

/** Importa tutte le schede del file, una alla volta: un errore su una
 *  scheda (es. dati non validi per il server) non blocca le altre, finisce
 *  solo nell'elenco `failed` restituito a fine importazione. Sempre
 *  additivo: nessuna scheda esistente viene toccata/sovrascritta, anche in
 *  caso di nome duplicato (stesso comportamento di "Duplica scheda"). */
export async function importWorkoutsFromFile(
  token: string,
  workouts: PortableWorkout[]
): Promise<ImportResult> {
  const catalog = await listExercises(token);
  const cache = new Map<string, Exercise>(catalog.map((e) => [e.name.trim().toLowerCase(), e]));

  const created: WorkoutDetail[] = [];
  const failed: Array<{ name: string; message: string }> = [];

  for (const portable of workouts) {
    try {
      const exerciseIds: string[] = [];
      for (const exercise of portable.exercises) {
        exerciseIds.push(await resolveExerciseId(token, exercise, cache));
      }
      const result = await createWorkout(token, toWorkoutInput(portable, exerciseIds));
      created.push(result);
    } catch (err) {
      failed.push({
        name: portable.name,
        message: err instanceof ApiRequestError ? err.message : "Errore imprevisto.",
      });
    }
  }

  return { created, failed };
}

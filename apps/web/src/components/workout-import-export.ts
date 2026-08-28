import type { Exercise, WorkoutDetail, WorkoutInput } from "@gym-tracker/shared";
import { ApiRequestError } from "../api/client";
import { listExercises } from "../api/exercises";
import { createWorkout } from "../api/workouts";
import {
  CsvImportError,
  parseCsvRows,
  parseOptionalNumber,
  slugify,
  todayIsoDate,
} from "../utils/csv";
import { buildExerciseCache, resolveExerciseId } from "../utils/resolve-exercise";

export { downloadCsvFile, readFileAsText, buildCsvText as toCsvText } from "../utils/csv";
/** Alias storico: stesso errore condiviso da tutte le funzionalità di
 *  import CSV (vedi utils/csv.ts), riesportato con questo nome perché
 *  pagine/test di questa funzionalità già lo importano così. */
export { CsvImportError as WorkoutImportFileError } from "../utils/csv";

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

export function singleWorkoutFilename(name: string): string {
  return `gym-tracker-${slugify(name, "scheda")}-${todayIsoDate()}.csv`;
}

export function planFilename(): string {
  return `gym-tracker-piano-${todayIsoDate()}.csv`;
}

// --- Import ---

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
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new CsvImportError("Il file è vuoto.");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const indexOf = new Map(header.map((h, i) => [h, i]));
  const missing = REQUIRED_COLUMNS.filter((c) => !indexOf.has(c));
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
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "scheda" è vuota.`);
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

    let workout = workoutByName.get(workoutName);
    if (!workout) {
      workout = { name: workoutName, notes: cell(row, "note_scheda") || null, exercises: [] };
      workoutByName.set(workoutName, workout);
      workouts.push(workout);
    }

    const exerciseKey = `${workoutName} ${position}`;
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
  const cache = buildExerciseCache(catalog);

  const created: WorkoutDetail[] = [];
  const failed: Array<{ name: string; message: string }> = [];

  for (const portable of workouts) {
    try {
      const exerciseIds: string[] = [];
      for (const exercise of portable.exercises) {
        exerciseIds.push(
          await resolveExerciseId(token, exercise.exerciseName, exercise.muscleGroup, cache)
        );
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

import type { MeasurementEntry, UserMeasurements } from "@gym-tracker/shared";
import { ApiRequestError } from "../api/client";
import { getMeasurements, updateMeasurements } from "../api/profile";
import {
  CsvImportError,
  buildCsvText,
  downloadCsvFile,
  parseCsvRows,
  parseOptionalNumber,
  readFileAsText,
  todayIsoDate,
} from "../utils/csv";

export { downloadCsvFile, readFileAsText, buildCsvText as toCsvText, CsvImportError };

/**
 * Formato del file di export/import dello storico misure: stesso principio
 * degli altri due CSV della webapp (schede, storico sessioni) — separatore
 * ";", BOM UTF-8 — ma qui una riga = una misurazione (nessuna gerarchia da
 * appiattire, a differenza di schede/sessioni). Colonna "data" obbligatoria,
 * le 5 misure opzionali (cella vuota = non registrata quel giorno, come già
 * possibile da Profilo > Misure atleta).
 *
 * A differenza di schede/storico sessioni non serve nessuna risoluzione per
 * nome (non c'è un catalogo da abbinare): ogni riga si importa in
 * autonomia, upsert per data lato server (`PUT /me/measurements`, vedi
 * quell'endpoint) — reimportare una data già presente la aggiorna invece di
 * duplicarla, stesso comportamento del form Misure.
 */
export const MEASUREMENT_CSV_COLUMNS = [
  "data",
  "peso_kg",
  "petto_cm",
  "braccio_cm",
  "vita_cm",
  "gamba_cm",
] as const;

const REQUIRED_MEASUREMENT_COLUMNS = ["data"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PortableMeasurement {
  measuredOn: string;
  weightKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
}

// --- Export ---

function numberOrEmpty(value: number | null): string {
  return value === null ? "" : String(value);
}

/** Righe CSV (inclusa l'intestazione) per lo storico misure: una riga per
 *  misurazione, più recenti prima come restituito da `GET /measurements`. */
export function buildMeasurementExportRows(entries: MeasurementEntry[]): string[][] {
  const rows: string[][] = [[...MEASUREMENT_CSV_COLUMNS]];
  for (const entry of entries) {
    rows.push([
      entry.measuredOn.slice(0, 10),
      numberOrEmpty(entry.weightKg),
      numberOrEmpty(entry.chestCm),
      numberOrEmpty(entry.armCm),
      numberOrEmpty(entry.waistCm),
      numberOrEmpty(entry.legCm),
    ]);
  }
  return rows;
}

export function measurementsFilename(): string {
  return `gym-tracker-misure-${todayIsoDate()}.csv`;
}

// --- Import ---

/** Valida e trasforma il CSV in misurazioni. Validazione solo strutturale
 *  (colonna "data" presente e valida, numeri ben formati): le regole di
 *  business (bound di sanità sui valori) restano al server. */
export function parseMeasurementImportCsv(text: string): PortableMeasurement[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new CsvImportError("Il file è vuoto.");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const indexOf = new Map(header.map((h, i) => [h, i]));
  const missing = REQUIRED_MEASUREMENT_COLUMNS.filter((c) => !indexOf.has(c));
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

  return dataRows.map((row, i) => {
    const rowNumber = i + 2; // +1 per l'intestazione, +1 perche' 1-based
    const dateRaw = cell(row, "data");
    if (!dateRaw) {
      throw new CsvImportError(`Riga ${rowNumber}: la colonna "data" è vuota.`);
    }
    if (!DATE_PATTERN.test(dateRaw) || Number.isNaN(Date.parse(dateRaw))) {
      throw new CsvImportError(
        `Riga ${rowNumber}: la colonna "data" deve essere in formato AAAA-MM-GG (es. 2026-01-31), non "${dateRaw}".`
      );
    }
    return {
      measuredOn: dateRaw,
      weightKg: parseOptionalNumber(cell(row, "peso_kg"), rowNumber, "peso_kg"),
      chestCm: parseOptionalNumber(cell(row, "petto_cm"), rowNumber, "petto_cm"),
      armCm: parseOptionalNumber(cell(row, "braccio_cm"), rowNumber, "braccio_cm"),
      waistCm: parseOptionalNumber(cell(row, "vita_cm"), rowNumber, "vita_cm"),
      legCm: parseOptionalNumber(cell(row, "gamba_cm"), rowNumber, "gamba_cm"),
    };
  });
}

export interface MeasurementImportResult {
  imported: number;
  failed: Array<{ measuredOn: string; message: string }>;
}

/** Registra tutte le misurazioni del file, una alla volta: un errore su una
 *  riga non blocca le altre, finisce solo nell'elenco `failed`. `heightCm`
 *  letto una sola volta all'inizio (valore corrente dell'account) e riusato
 *  identico su ogni chiamata: `PUT /me/measurements` lo sovrascrive sempre
 *  (vedi quell'endpoint, nessun patch parziale), quindi senza questo non
 *  cambierebbe solo lo storico ma anche l'altezza corrente, azzerandola sulle
 *  righe che non la portano. */
export async function importMeasurementsFromFile(
  token: string,
  entries: PortableMeasurement[]
): Promise<MeasurementImportResult> {
  const current: UserMeasurements = await getMeasurements(token);

  let imported = 0;
  const failed: MeasurementImportResult["failed"] = [];

  for (const entry of entries) {
    try {
      await updateMeasurements(token, {
        heightCm: current.heightCm,
        weightKg: entry.weightKg,
        chestCm: entry.chestCm,
        armCm: entry.armCm,
        waistCm: entry.waistCm,
        legCm: entry.legCm,
        measuredOn: entry.measuredOn,
      });
      imported++;
    } catch (err) {
      failed.push({
        measuredOn: entry.measuredOn,
        message: err instanceof ApiRequestError ? err.message : "Errore imprevisto.",
      });
    }
  }

  return { imported, failed };
}

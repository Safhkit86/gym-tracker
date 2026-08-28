/**
 * Machinery CSV generica condivisa da tutte le funzionalità di
 * import/export della webapp (schede in components/workout-import-export.ts,
 * storico in components/session-import-export.ts): parsing/serializzazione
 * RFC 4180 con separatore ";" (non ","), scelto perché con la virgola come
 * separatore decimale (locale italiana) Excel si aspetta ";" come
 * separatore di lista — vedi il commento più esteso in
 * workout-import-export.ts per il ragionamento completo.
 */

/** Errore di parsing/validazione di un file CSV importato: messaggio già
 *  pronto per l'utente, mai i dettagli tecnici del parse. */
export class CsvImportError extends Error {}

/** Legge il contenuto testuale di un file scelto dall'utente. FileReader
 *  invece del più diretto `File.prototype.text()`: quest'ultimo non è
 *  implementato da jsdom (l'ambiente dei test), FileReader sì. */
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
export function parseCsvRows(text: string): string[][] {
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

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serializza le righe in testo CSV: separatore ";", terminatore di riga
 *  CRLF (lo standard del formato) e un BOM UTF-8 in testa — senza, Excel su
 *  Windows spesso interpreta un CSV UTF-8 come ANSI e mostra le lettere
 *  accentate (à, è, ì, ò, ù) come caratteri corrotti. */
export function buildCsvText(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvField).join(";")).join("\r\n")}\r\n`;
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

/** Tollera la virgola come separatore decimale (locale italiana, comune
 *  editando a mano in Excel: "82,5") oltre al punto. Cella vuota = null. */
export function parseOptionalNumber(raw: string, rowNumber: number, column: string): number | null {
  if (raw === "") {
    return null;
  }
  const value = Number(raw.replace(",", "."));
  if (Number.isNaN(value)) {
    throw new CsvImportError(
      `Riga ${rowNumber}: la colonna "${column}" non è un numero valido ("${raw}").`
    );
  }
  return value;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Slug da usare nel nome del file scaricato: minuscolo, solo lettere/numeri/trattini.
 *  `fallback` copre il caso in cui `text` non produca nessun carattere valido
 *  (es. un nome fatto solo di punteggiatura). */
export function slugify(text: string, fallback: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove gli accenti (es. "è" -> "e"), scomposti da normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

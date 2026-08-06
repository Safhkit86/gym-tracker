import type { MeasurementEntry } from "@gym-tracker/shared";

/** Stessi campi di apps/web/src/utils/measurements.ts, ma senza `label`
 *  hardcoded in italiano: l'app mobile e' multi-lingua fin dal principio
 *  (a differenza della webapp), quindi l'etichetta si legge dal catalogo
 *  i18n (vedi history.measurements.<key> nei locales) invece che da qui. */
export const MEASUREMENT_FIELDS = [
  { key: "weightKg", unit: "kg" },
  { key: "chestCm", unit: "cm" },
  { key: "armCm", unit: "cm" },
  { key: "waistCm", unit: "cm" },
  { key: "legCm", unit: "cm" },
] as const;

/** Differenza rispetto alla misurazione precedente: positiva se il valore e'
 *  aumentato nel tempo. Mostrata sulla misurazione nuova (non su quella
 *  vecchia). Arrotondata a un decimale per evitare artefatti di virgola
 *  mobile (es. 79.1 - 78.4). null se uno dei due valori manca o non e'
 *  cambiato (nessuna freccia da mostrare). Stesso comportamento di
 *  apps/web/src/utils/measurements.ts. */
export function computeDelta(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) {
    return null;
  }
  const diff = Math.round((current - previous) * 10) / 10;
  return diff !== 0 ? diff : null;
}

export interface MeasureTileData {
  field: (typeof MEASUREMENT_FIELDS)[number];
  values: number[];
  current: number;
  delta: number | null;
}

/** Un tile per campo con storico non vuoto (valore attuale + delta +
 *  serie completa per lo sparkline) — estratto dalla tile "Misure" di
 *  Dashboard perche' ora la riusa anche il tab Misure di Statistiche
 *  (vedi MeasureTilesGrid.tsx), stessa logica in un solo posto invece di
 *  duplicata in due schermate. */
export function computeMeasureTiles(measurements: MeasurementEntry[]): MeasureTileData[] {
  return MEASUREMENT_FIELDS.map((field) => {
    const nonNull = measurements.filter((m) => m[field.key] !== null);
    if (nonNull.length === 0) {
      return null;
    }
    const chronological = [...nonNull].reverse();
    const values = chronological.map((m) => m[field.key] as number);
    const current = values[values.length - 1];
    if (current === undefined) {
      return null;
    }
    const previous = values.length > 1 ? (values[values.length - 2] ?? null) : null;
    return { field, values, current, delta: computeDelta(previous, current) };
  }).filter((tile): tile is MeasureTileData => tile !== null);
}

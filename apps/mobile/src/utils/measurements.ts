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

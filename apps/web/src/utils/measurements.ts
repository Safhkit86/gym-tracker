export const MEASUREMENT_FIELDS = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "chestCm", label: "Petto", unit: "cm" },
  { key: "armCm", label: "Braccia", unit: "cm" },
  { key: "waistCm", label: "Vita", unit: "cm" },
  { key: "legCm", label: "Gamba", unit: "cm" },
] as const;

/** Differenza rispetto alla misurazione precedente: positiva se il valore e'
 *  aumentato nel tempo. Mostrata sulla misurazione nuova (non su quella
 *  vecchia): e' quella che racconta "rispetto a prima, ora sei cambiato
 *  cosi'". Arrotondata a un decimale per evitare artefatti di virgola
 *  mobile (es. 79.1 - 78.4). null se uno dei due valori manca o non e'
 *  cambiato (nessuna freccia da mostrare). */
export function computeDelta(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) {
    return null;
  }
  const diff = Math.round((current - previous) * 10) / 10;
  return diff !== 0 ? diff : null;
}

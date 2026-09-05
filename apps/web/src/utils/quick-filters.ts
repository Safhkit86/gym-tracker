/** Filtri rapidi periodo per Storico (sessioni e misure): "all" = nessun
 *  filtro (parametro `since` omesso dalla richiesta paginata). */
export type QuickFilterPreset = "1M" | "3M" | "1Y" | "5Y" | "all";

export const QUICK_FILTER_PRESETS: Array<{ value: QuickFilterPreset; label: string }> = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1Y", label: "1Y" },
  { value: "5Y", label: "5Y" },
  { value: "all", label: "Tutto" },
];

/** Data di inizio (yyyy-mm-dd, UTC) per il preset scelto, da passare come
 *  `since` a listSessionsPage/listMeasurementsPage; undefined per "all"
 *  (nessun filtro). `now` iniettabile per i test. */
export function sinceForQuickFilter(preset: QuickFilterPreset, now = new Date()): string | undefined {
  if (preset === "all") {
    return undefined;
  }
  const date = new Date(now);
  switch (preset) {
    case "1M":
      date.setUTCMonth(date.getUTCMonth() - 1);
      break;
    case "3M":
      date.setUTCMonth(date.getUTCMonth() - 3);
      break;
    case "1Y":
      date.setUTCFullYear(date.getUTCFullYear() - 1);
      break;
    case "5Y":
      date.setUTCFullYear(date.getUTCFullYear() - 5);
      break;
  }
  return date.toISOString().slice(0, 10);
}

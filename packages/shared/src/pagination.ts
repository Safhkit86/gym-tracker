/**
 * Paginazione lato server per le liste che crescono nel tempo senza un
 * limite naturale (storico sessioni, storico misure, notifiche) — non per
 * le viste di aggregazione (Dashboard, Statistiche), che continuano a
 * leggere l'intero storico per calcolare i loro aggregati. `page` parte da
 * 1 (non 0), `pageSize` e' limitato a `MAX_PAGE_SIZE` lato server a
 * prescindere da cosa chiede il client, per evitare che un client possa
 * chiedere l'intera tabella in una volta.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Interpreta i query param `page`/`pageSize` di una richiesta Express,
 *  tollerante a valori assenti/non numerici/fuori range (fallback ai
 *  default invece di un errore 400: gli endpoint paginati funzionano anche
 *  senza questi due parametri, tornando semplicemente la prima pagina). */
export function parsePaginationQuery(query: {
  page?: unknown;
  pageSize?: unknown;
}): { page: number; pageSize: number } {
  const parsedPage = typeof query.page === "string" ? Number(query.page) : NaN;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const parsedPageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : NaN;
  const pageSize =
    Number.isInteger(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

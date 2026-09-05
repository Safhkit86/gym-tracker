interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Controlli "Precedente/Successiva" + "Pagina X di Y" per le liste
 *  paginate lato server (Storico, Notifiche). Nulla se una sola pagina. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className="toolbar pagination">
      <button
        type="button"
        className="secondary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Precedente
      </button>
      <span className="pagination__status">
        Pagina {page} di {totalPages}
      </span>
      <button
        type="button"
        className="secondary"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Successiva →
      </button>
    </div>
  );
}

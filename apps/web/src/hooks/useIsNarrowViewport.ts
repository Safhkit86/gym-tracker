import { useEffect, useState } from "react";

/** Sotto questa larghezza le tabelle a colonne fisse (Storico, Registra
 *  sessione) non entrano più nella card senza scroll orizzontale: sotto la
 *  soglia le pagine passano a un layout impilato (un blocco per esercizio,
 *  campi in verticale). Stessa soglia per tutta la webapp, vedi CLAUDE.md. */
export const NARROW_TABLE_LAYOUT_QUERY = "(max-width: 1024px)";

export function useIsNarrowViewport(query: string): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(query);
    setIsNarrow(mql.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return isNarrow;
}

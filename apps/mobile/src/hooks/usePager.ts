import { useMemo, useState } from "react";

interface Pager<T> {
  visible: T[];
  start: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
}

/** Paginazione a frecce (mai scroll), stessa logica di apps/web/src/hooks/usePager.ts:
 *  riusata da tutti i widget della Dashboard che mostrano solo una finestra
 *  di N elementi alla volta. Si blocca ai bordi, nessun wrap-around. */
export function usePager<T>(items: T[], pageSize: number): Pager<T> {
  const [start, setStart] = useState(0);
  const clampedStart = Math.min(start, Math.max(0, items.length - pageSize));

  const visible = useMemo(
    () => items.slice(clampedStart, clampedStart + pageSize),
    [items, clampedStart, pageSize]
  );

  return {
    visible,
    start: clampedStart,
    total: items.length,
    canPrev: clampedStart > 0,
    canNext: clampedStart + pageSize < items.length,
    prev: () => setStart(Math.max(0, clampedStart - pageSize)),
    next: () => setStart(Math.min(Math.max(0, items.length - pageSize), clampedStart + pageSize)),
  };
}

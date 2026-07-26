import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from "./icons";

interface PagerControlsProps {
  start: number;
  pageSize: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Orizzontale (frecce ←→) per liste in riga come i gruppi muscolari,
   *  verticale (frecce ↑↓) per liste verticali come gli esercizi. */
  orientation: "horizontal" | "vertical";
  prevLabel: string;
  nextLabel: string;
}

/** Paginazione a frecce (mai scrollbar): stessa indicazione "X–Y di Z" e
 *  stesso stile in tutti i widget della Dashboard che mostrano solo una
 *  finestra di elementi alla volta. */
export function PagerControls({
  start,
  pageSize,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
  orientation,
  prevLabel,
  nextLabel,
}: PagerControlsProps) {
  const PrevIcon = orientation === "horizontal" ? ChevronLeftIcon : ChevronUpIcon;
  const NextIcon = orientation === "horizontal" ? ChevronRightIcon : ChevronDownIcon;

  return (
    <div className="pager">
      <button
        type="button"
        className="pager__btn"
        aria-label={prevLabel}
        onClick={onPrev}
        disabled={!canPrev}
      >
        <PrevIcon />
      </button>
      <span className="pager__indicator">
        {total === 0 ? "0 di 0" : `${start + 1}–${Math.min(start + pageSize, total)} di ${total}`}
      </span>
      <button
        type="button"
        className="pager__btn"
        aria-label={nextLabel}
        onClick={onNext}
        disabled={!canNext}
      >
        <NextIcon />
      </button>
    </div>
  );
}

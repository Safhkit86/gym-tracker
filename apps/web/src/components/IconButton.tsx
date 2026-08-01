import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

interface IconButtonProps {
  icon: ReactNode;
  /** Usato sia come nome accessibile (aria-label) sia come testo del tooltip. */
  label: string;
  /** Se presente, l'azione naviga (Link); altrimenti apre un'azione/dialog (button). */
  to?: string;
  onClick?: () => void;
  variant?: "accent" | "danger";
  disabled?: boolean;
}

interface TooltipPosition {
  top: number;
  left: number;
}

/** Margine minimo dai bordi della finestra, per non far uscire il tooltip
 *  dallo schermo quando il pulsante e' vicino al bordo (stima approssimata
 *  di meta' larghezza tooltip, sufficiente per le etichette brevi usate qui). */
const TOOLTIP_VIEWPORT_PADDING = 70;

/** Pulsante a icona con tooltip. Il tooltip e' renderizzato in un portal su
 *  `document.body`, posizionato con `position: fixed` calcolato al volo
 *  dalla bounding box del pulsante: non e' piu' un discendente assoluto
 *  di eventuali contenitori con scroll orizzontale (es. le tabelle di
 *  "Registra sessione"), quindi non contribuisce piu' al loro scrollWidth
 *  (niente scrollbar orizzontale indesiderata) e non puo' restare
 *  nascosto dietro elementi sticky/altri stacking context locali. */
export function IconButton({ icon, label, to, onClick, variant, disabled }: IconButtonProps) {
  const buttonRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  function showTooltip(): void {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, TOOLTIP_VIEWPORT_PADDING),
      window.innerWidth - TOOLTIP_VIEWPORT_PADDING
    );
    setTooltipPosition({ top: rect.top, left });
  }

  function hideTooltip(): void {
    setTooltipPosition(null);
  }

  const className = [
    "icon-btn",
    variant === "accent" && "icon-btn--accent",
    variant === "danger" && "icon-btn--danger",
  ]
    .filter(Boolean)
    .join(" ");

  const hoverHandlers = {
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
  };

  const tooltip =
    tooltipPosition &&
    createPortal(
      <span
        className="icon-btn-tooltip"
        role="tooltip"
        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
      >
        {label}
      </span>,
      document.body
    );

  if (to) {
    return (
      <>
        <Link ref={buttonRef} to={to} className={className} aria-label={label} {...hoverHandlers}>
          {icon}
        </Link>
        {tooltip}
      </>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        {...hoverHandlers}
      >
        {icon}
      </button>
      {tooltip}
    </>
  );
}

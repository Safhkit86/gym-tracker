import type { ReactNode } from "react";
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

export function IconButton({ icon, label, to, onClick, variant, disabled }: IconButtonProps) {
  const className = [
    "icon-btn",
    variant === "accent" && "icon-btn--accent",
    variant === "danger" && "icon-btn--danger",
  ]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} className={className} aria-label={label} data-tip={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      data-tip={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

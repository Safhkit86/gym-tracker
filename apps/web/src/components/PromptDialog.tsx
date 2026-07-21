import { useEffect, useState } from "react";

interface PromptDialogProps {
  open: boolean;
  message: string;
  label: string;
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** Popup di conferma con un campo testo (es. nome della scheda duplicata). */
export function PromptDialog({
  open,
  message,
  label,
  initialValue,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [open, initialValue]);

  if (!open) {
    return null;
  }

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog card" role="alertdialog" aria-modal="true">
        <p>{message}</p>
        <label>
          {label}
          <input value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </label>
        <div className="confirm-dialog__actions">
          <button type="button" onClick={() => onConfirm(value)} disabled={!value.trim()}>
            Sì
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Popup di conferma per azioni distruttive (elimina scheda, rimuovi esercizio). */
export function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog card" role="alertdialog" aria-modal="true">
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" onClick={onConfirm}>
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

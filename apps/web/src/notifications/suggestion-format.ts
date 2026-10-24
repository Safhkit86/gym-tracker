import type {
  Notification,
  ProgressionDefault,
  ProgressionSuggestionType,
} from "@gym-tracker/shared";

// Copia locale di isActionableSuggestion (packages/shared/src/progress.ts):
// e' un valore (funzione), non un tipo, quindi non si puo' importare dal
// barrel di @gym-tracker/shared senza farci cadere dentro l'intero
// barrel (anche i moduli solo-Node), vedi CLAUDE.md.
function isActionableSuggestion(type: ProgressionSuggestionType): boolean {
  return type === "increase_weight" || type === "increase_reps";
}

/** Un nuovo massimale non e' un suggerimento su cui agire (niente prefill
 *  override, niente pulsante "Accetta"): solo il riconoscimento di un
 *  risultato gia' raggiunto. Usato da NotificationsPage per condizionare il
 *  pulsante "Accetta progressione" e da LogSessionPage per il trattamento
 *  del badge. Accetta sia Notification che ProgressionEvent (stesso campo
 *  suggestionType su entrambi), non solo Notification. */
export function isPersonalRecord(item: { suggestionType: ProgressionSuggestionType }): boolean {
  return !isActionableSuggestion(item.suggestionType);
}

/** Override "accetta progressione" da mandare per una notifica: assente se
 *  e' un nuovo massimale (vedi isPersonalRecord) o se per qualche motivo il
 *  suggerimento non ha un valore (non dovrebbe mai succedere, il motore lo
 *  valorizza sempre quando genera un evento azionabile). Condiviso da
 *  NotificationsPage e DashboardPage. */
export function toOverride(notification: Notification): ProgressionDefault | null {
  if (notification.suggestedValue === null || isPersonalRecord(notification)) {
    return null;
  }
  return {
    exerciseId: notification.exerciseId,
    suggestionType: notification.suggestionType,
    value: notification.suggestedValue,
  };
}

/** "20kg -> 22kg" o "10 -> 11 rip.": entrambi i valori sono sempre presenti
 *  quando il motore genera un suggerimento, ma restiamo difensivi (stringa
 *  vuota, niente riga) se per qualche motivo mancano. "_weight" (sia
 *  increase_weight che personal_record_weight) usa kg, l'altra coppia le
 *  ripetizioni. */
export function formatSuggestionDelta(notification: Notification): string {
  if (notification.previousValue === null || notification.suggestedValue === null) {
    return "";
  }
  const previous = Math.round(notification.previousValue * 10) / 10;
  const suggested = Math.round(notification.suggestedValue * 10) / 10;
  return notification.suggestionType.endsWith("_weight")
    ? `${previous}kg → ${suggested}kg`
    : `${previous} → ${suggested} rip.`;
}

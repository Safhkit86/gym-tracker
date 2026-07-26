import type { Notification, ProgressionDefault } from "@gym-tracker/shared";

/** Override "accetta progressione" da mandare per una notifica: assente se
 *  per qualche motivo il suggerimento non ha un valore (non dovrebbe mai
 *  succedere, il motore lo valorizza sempre quando genera un evento).
 *  Condiviso da NotificationsPage e DashboardPage. */
export function toOverride(notification: Notification): ProgressionDefault | null {
  if (notification.suggestedValue === null) {
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
 *  vuota, niente riga) se per qualche motivo mancano. */
export function formatSuggestionDelta(notification: Notification): string {
  if (notification.previousValue === null || notification.suggestedValue === null) {
    return "";
  }
  const previous = Math.round(notification.previousValue * 10) / 10;
  const suggested = Math.round(notification.suggestedValue * 10) / 10;
  return notification.suggestionType === "increase_weight"
    ? `${previous}kg → ${suggested}kg`
    : `${previous} → ${suggested} rip.`;
}

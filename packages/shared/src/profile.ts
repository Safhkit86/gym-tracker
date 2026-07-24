/**
 * Misure fisiche dell'atleta: solo il valore corrente (nessuno storico),
 * tutte opzionali. Stessa forma per lettura e per l'update (replace
 * completo, non patch parziale: il form invia sempre tutti i campi).
 */
export interface UserMeasurements {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
}

export type UpdateUserMeasurementsRequest = UserMeasurements;

/**
 * Parametri per-utente del motore di progressione (progress-service):
 * dopo quante sessioni consecutive al massimo delle rep suggerire un
 * aumento, e se il conteggio raggruppa le sessioni per scheda+esercizio
 * (comportamento storico) o per solo esercizio, indipendentemente dalla
 * scheda in cui compare (es. lo stesso esercizio in due schede diverse
 * della settimana).
 */
export interface ProgressionPreferences {
  requiredConsecutiveSessions: number;
  groupingScope: "workout" | "exercise";
}

export type UpdateProgressionPreferencesRequest = ProgressionPreferences;

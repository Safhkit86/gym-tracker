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

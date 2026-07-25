import type { ProgressionSuggestionType } from "./progress.js";

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
 *
 * `prefillScope` e' un concetto distinto (non riguarda il motore di
 * suggerimento, ma la precompilazione delle rep effettive quando si apre
 * Registra sessione, vedi LogSessionPage.tsx): se le ultime rep storicizzate
 * da riproporre vengono cercate per scheda+esercizio (comportamento
 * storico) o per solo esercizio, indipendentemente dalla scheda.
 *
 * `timerSoundEnabled` e' ancora distinto (niente a che vedere col motore di
 * progressione): se il timer di recupero in Registra sessione deve suonare
 * un allarme a fine conto alla rovescia, vedi useRestTimers.ts.
 */
export interface ProgressionPreferences {
  requiredConsecutiveSessions: number;
  groupingScope: "workout" | "exercise";
  prefillScope: "workout" | "exercise";
  timerSoundEnabled: boolean;
}

export type UpdateProgressionPreferencesRequest = ProgressionPreferences;

/**
 * Override "una tantum" del prefill di Registra sessione, creato quando
 * l'utente preme "Accetta progressione" su una notifica: da quel momento la
 * prossima registrazione di questo esercizio (in qualunque scheda in cui
 * compare) parte gia' dal valore suggerito, invece che dall'ultima sessione
 * effettivamente registrata. Consumato (eliminato) automaticamente alla
 * prima registrazione successiva per quell'esercizio.
 */
export interface ProgressionDefault {
  exerciseId: string;
  suggestionType: ProgressionSuggestionType;
  value: number;
}

export interface AcceptProgressionDefaultsRequest {
  overrides: ProgressionDefault[];
}

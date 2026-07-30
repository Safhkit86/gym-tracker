import type { ProgressionSuggestionType } from "./progress.js";

/**
 * Misure fisiche dell'atleta: `heightCm` e' l'unico valore "corrente" vero
 * e proprio (account-service, nessuno storico). Le altre 5 sono le ultime
 * misure storicizzate note (history-service, tabella `measurement_entries`,
 * lette via cache Redis lato account-service) — vedi `MeasurementEntry` per
 * lo storico completo con data. Tutte opzionali. Stessa forma per lettura e
 * per l'update (replace completo, non patch parziale: il form invia sempre
 * tutti i campi).
 */
export interface UserMeasurements {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
}

/**
 * `measuredOn`: data della misurazione (solo se `historicizeMeasurements` e'
 * attivo e l'utente ne sceglie una diversa da oggi); omesso o assente =>
 * oggi. Upsert per (userId, measuredOn) lato history-service: salvare di
 * nuovo sulla stessa data aggiorna quell'entry invece di duplicarla.
 */
export type UpdateUserMeasurementsRequest = UserMeasurements & {
  measuredOn?: string;
};

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

/**
 * Preferenze utente non legate al motore di progressione (account-service,
 * Profilo > Preferenze): niente a che vedere con lo storico o col motore di
 * suggerimento, solo consumate lato client.
 *
 * `prefillScope`: se le ultime rep storicizzate da riproporre in Registra
 * sessione (vedi LogSessionPage.tsx) vengono cercate per scheda+esercizio
 * (comportamento storico) o per solo esercizio, indipendentemente dalla
 * scheda.
 *
 * `timerSoundEnabled`: se il timer di recupero in Registra sessione deve
 * suonare un allarme a fine conto alla rovescia, vedi useRestTimers.ts.
 *
 * `historicizeMeasurements`: se true, il form Misure mostra il selettore
 * data (la misurazione puo' essere salvata su una data passata); se false
 * il selettore e' nascosto e si salva sempre su oggi. In entrambi i casi
 * il salvataggio va sempre in `measurement_entries` (nessun cambio di
 * percorso di scrittura, solo di UI) — vedi `MeasurementEntry`.
 */
export interface AccountPreferences {
  prefillScope: "workout" | "exercise";
  timerSoundEnabled: boolean;
  historicizeMeasurements: boolean;
}

export type UpdateAccountPreferencesRequest = AccountPreferences;

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

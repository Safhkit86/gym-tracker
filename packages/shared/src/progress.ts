import type { SessionDetail } from "./history.js";

/**
 * Contratti di progress-service: motore di regole di progressione. Storico
 * sessioni/statistiche vivono in history-service (vedi history.ts) da quando
 * i due servizi si sono separati.
 */

export type ProgressionSuggestionType = "increase_weight" | "increase_reps";

/**
 * Suggerimento emesso dal motore di regole quando lo storico soddisfa la
 * condizione di progressione. `source` e' l'aggancio per una futura fonte
 * "ai" (analisi statistica dello storico che propone essa stessa il valore);
 * in questa fase e' sempre "rule" (regola fissa, incremento configurato
 * dall'utente sulla scheda).
 */
export interface ProgressionEvent {
  id: string;
  exerciseId: string;
  exerciseName: string;
  triggeringSessionId: string;
  suggestionType: ProgressionSuggestionType;
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
  source: "rule" | "ai";
  createdAt: string;
}

/** Risposta di POST /sessions: la sessione creata + eventuali suggerimenti
 *  (solo se gia' disponibili sincronamente; altrimenti si passa dal polling
 *  di GET /sessions/:id/status, vedi SessionStatus). */
export interface CreateSessionResponse extends SessionDetail {
  suggestions: ProgressionEvent[];
}

/**
 * Payload pubblicato su RabbitMQ (coda "progression-events"): include
 * `userId`, assente dal DTO di GET /progression perche' li' il chiamante e'
 * gia' autenticato come proprietario. notify-service lo usa per sapere a chi
 * appartiene la notifica.
 */
export interface ProgressionEventMessage extends ProgressionEvent {
  userId: string;
}

/**
 * Nome della coda RabbitMQ su cui progress-service pubblica e notify-service
 * consuma: vive qui (non in un solo servizio) perche' e' un contratto tra i
 * due, non un dettaglio implementativo di uno solo.
 */
export const PROGRESSION_EVENTS_QUEUE = "progression-events";

/** L'esercizio col maggior divario dall'ultima progressione (o dal primo
 *  log, se non ne ha mai avuta una), oltre la soglia minima per essere
 *  segnalato, e ancora allenato attivamente di recente. */
export interface StalledExercise {
  exerciseId: string;
  exerciseName: string;
  daysSinceLastProgression: number;
}

/**
 * Stato dell'elaborazione asincrona di una sessione appena registrata (GET
 * /sessions/:id/status, progress-service): la valutazione del motore di
 * regole avviene consumando `session-logged` (history-service), non piu'
 * nella stessa richiesta HTTP di POST /sessions. Il client fa un breve
 * polling per continuare a mostrare subito l'eventuale suggerimento, come
 * prima dello split.
 */
export type SessionProcessingStatus = "pending" | "no-suggestion" | "with-suggestion";

export interface SessionStatus {
  status: SessionProcessingStatus;
  suggestions: ProgressionEvent[];
}

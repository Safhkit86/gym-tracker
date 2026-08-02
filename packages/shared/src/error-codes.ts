/**
 * Registro dei valori `ApiError.code` (vedi `api-error.ts`) usati nel
 * backend. Non genera nulla e non e' importato dai servizi per lanciare
 * errori (restano `AppError`/sottoclassi con la stringa scritta a mano,
 * vedi errors.ts di ogni servizio) — e' documentazione centralizzata,
 * pensata per due usi:
 *
 * 1. Fonte di verita' unica su quali codici esistono e cosa significano,
 *    invece di stringhe letterali sparse e non documentate per servizio.
 * 2. Punto di partenza per un client che vuole tradurre i messaggi (es.
 *    l'app mobile multi-lingua, vedi apps/mobile/src/i18n): ogni client
 *    puo' mappare questi codici sul proprio catalogo di traduzioni, con
 *    `ApiError.message` (oggi sempre in italiano) come fallback per i
 *    codici non ancora mappati.
 *
 * Non e' ancora un elenco esaustivo di ogni possibile codice (in
 * particolare i `BadRequestError`/`ConflictError` di dominio, che
 * accettano un codice a scelta del chiamante per ogni rotta, non sono
 * tutti censiti qui) — va esteso quando se ne aggiungono di nuovi o se ne
 * scoprono di mancanti, non e' vincolante per il backend.
 */
export const ERROR_CODES = {
  // --- Comuni a piu' servizi/al gateway ---
  UNAUTHORIZED: "Token assente, non valido o scaduto.",
  NOT_FOUND: "Risorsa non trovata, o esiste ma non appartiene al chiamante (no info leak).",
  VALIDATION_ERROR: "Corpo/parametri della richiesta non validi (Zod, o BadRequestError generico).",
  INTERNAL_ERROR: "Errore non gestito, mappato a 500.",
  RATE_LIMITED: "Troppe richieste dallo stesso IP (api-gateway).",
  UPSTREAM_UNAVAILABLE: "Il servizio a monte non e' raggiungibile (api-gateway).",

  // --- account-service ---
  EMAIL_ALREADY_IN_USE: "Registrazione con un'email gia' in uso.",
  INVALID_CREDENTIALS: "Login con email/password errati.",
  INVALID_CURRENT_PASSWORD: "Cambio password: la password attuale fornita e' sbagliata.",
  INVALID_OTP: "Cambio password: codice OTP errato o scaduto.",
  INVALID_RESET_TOKEN:
    "Reset password: link scaduto, gia' usato, o mai esistito (stesso messaggio per tutti i casi, deliberatamente).",
  NO_PENDING_PASSWORD_CHANGE: "Conferma di un cambio password senza una richiesta attiva.",

  // --- workout-service ---
  EXERCISE_ALREADY_EXISTS: "Creazione di un esercizio custom con un nome gia' usato dall'utente.",
} as const satisfies Record<string, string>;

export type ErrorCode = keyof typeof ERROR_CODES;

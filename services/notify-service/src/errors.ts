/**
 * Errori di dominio con uno status HTTP e un codice stabile.
 * L'error handler li mappa nella forma `ApiError` di @gym-tracker/shared.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticazione richiesta.") {
    super(401, "UNAUTHORIZED", message);
  }
}

/** Usata anche quando una risorsa esiste ma non e' del richiedente (no info leak). */
export class NotFoundError extends AppError {
  constructor(message = "Risorsa non trovata.") {
    super(404, "NOT_FOUND", message);
  }
}

export class BadRequestError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(400, code, message, details);
  }
}

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

export class EmailAlreadyInUseError extends AppError {
  constructor(email: string) {
    super(409, "EMAIL_ALREADY_IN_USE", "Esiste gia' un utente con questa email.", {
      email,
    });
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Email o password non validi.");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticazione richiesta.") {
    super(401, "UNAUTHORIZED", message);
  }
}

// Messaggio identico per ogni causa di fallimento (scaduto/usato/non trovato/
// tentativi esauriti): non deve rivelare quale caso specifico si e' verificato.

export class InvalidResetTokenError extends AppError {
  constructor() {
    super(400, "INVALID_RESET_TOKEN", "Link di reset non valido o scaduto.");
  }
}

export class InvalidCurrentPasswordError extends AppError {
  constructor() {
    super(400, "INVALID_CURRENT_PASSWORD", "Password attuale non corretta.");
  }
}

export class InvalidOtpError extends AppError {
  constructor() {
    super(400, "INVALID_OTP", "Codice non valido o scaduto.");
  }
}

export class NoPendingPasswordChangeError extends AppError {
  constructor() {
    super(400, "NO_PENDING_PASSWORD_CHANGE", "Nessuna richiesta di cambio password in corso.");
  }
}

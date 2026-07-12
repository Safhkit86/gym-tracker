/**
 * Tipi condivisi tra i microservizi di gym-tracker.
 * Questo pacchetto viene importato da ogni servizio come dipendenza
 * di workspace (@gym-tracker/shared) per evitare di duplicare i contratti.
 */

export interface HealthStatus {
  service: string;
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Contratti di autenticazione condivisi (auth-service, futuro API Gateway,
 * client web/Android). Non includono mai il password hash.
 */

/** Proiezione pubblica di un utente: mai esposto il password hash. */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Risposta di register/login: token di accesso + utente pubblico. */
export interface AuthResponse {
  token: string;
  user: PublicUser;
}

/** Claim del JWT di accesso emesso da auth-service. */
export interface AuthTokenClaims {
  /** id utente (subject) */
  sub: string;
  email: string;
}

/**
 * Costruisce una risposta di health check coerente tra tutti i servizi.
 */
export function buildHealthStatus(
  service: string,
  version: string,
  status: HealthStatus["status"] = "ok"
): HealthStatus {
  return {
    service,
    status,
    version,
    timestamp: new Date().toISOString(),
  };
}

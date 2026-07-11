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

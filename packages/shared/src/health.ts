export interface HealthStatus {
  service: string;
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
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

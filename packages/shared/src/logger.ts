import pino, { type Logger } from "pino";

export type { Logger };

export interface CreateLoggerOptions {
  /** Default "info"; i test passano "silent" per non intasare l'output. */
  level?: string;
}

/**
 * Logger strutturato condiviso da ogni servizio, al posto di `console.*`
 * (vedi CLAUDE.md). Sempre JSON, nessun transport di formattazione: lo scope
 * di questa fase e' "leggero", niente dipendenza in piu' solo per
 * l'estetica in dev. Ogni riga porta gia' `service` per distinguere le
 * sorgenti quando i log di piu' servizi finiscono nello stesso posto.
 */
export function createLogger(service: string, options: CreateLoggerOptions = {}): Logger {
  return pino({
    base: { service },
    level: options.level ?? "info",
  });
}

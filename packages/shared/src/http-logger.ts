import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Middleware di logging per richiesta (pino-http): metodo, path, status,
 * durata, e un id di correlazione. Se il chiamante ha gia' mandato
 * `X-Request-Id` (es. api-gateway lo inoltra ai servizi a valle) lo riusa
 * invece di generarne uno nuovo, cosi' le righe di log della stessa
 * richiesta si possono correlare tra servizi diversi grep-ando lo stesso id.
 * Il Bearer token non finisce mai nei log (redact).
 */
export function createHttpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers[REQUEST_ID_HEADER];
      const id = typeof existing === "string" && existing.length > 0 ? existing : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    redact: ["req.headers.authorization"],
  });
}

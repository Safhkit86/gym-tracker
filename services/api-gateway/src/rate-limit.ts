import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

export interface RateLimitConfig {
  /** Finestra temporale, in millisecondi. Default: 15 minuti. */
  windowMs?: number;
  /** Richieste massime nella finestra, per IP, su tutte le rotte protette dal gateway. Default: 300. */
  globalMax?: number;
  /** Richieste massime nella finestra, per IP, sulle rotte /auth (login/registrazione). Default: 10. */
  authMax?: number;
}

export interface RateLimiters {
  global: RateLimitRequestHandler;
  auth: RateLimitRequestHandler;
}

/**
 * Store in memoria: corretto per la topologia attuale (una sola istanza del
 * gateway, nessun bilanciamento di carico dietro un load balancer). Un store
 * condiviso (es. Redis, gia' provisionato in docker-compose.yml ma
 * inutilizzato) avrebbe senso solo se il gateway venisse scalato a piu'
 * repliche: non necessario ora, quindi non costruito in questa PR.
 */
export function createRateLimiters(config: RateLimitConfig = {}): RateLimiters {
  const windowMs = config.windowMs ?? 15 * 60 * 1000;

  const global = rateLimit({
    windowMs,
    limit: config.globalMax ?? 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      req.log.warn("rate limit globale superato");
      res.status(429).json({ code: "RATE_LIMITED", message: "Troppe richieste, riprova più tardi." });
    },
  });

  const auth = rateLimit({
    windowMs,
    limit: config.authMax ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      req.log.warn("rate limit login superato");
      res.status(429).json({
        code: "RATE_LIMITED",
        message: "Troppi tentativi di accesso, riprova più tardi.",
      });
    },
  });

  return { global, auth };
}

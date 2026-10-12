import type { NextFunction, Request, RequestHandler, Response } from "express";
import { extractAuthToken, type AccessTokenService } from "@gym-tracker/shared";

/**
 * Verifica centralizzata del token (Bearer, app mobile, o cookie httpOnly,
 * webapp — vedi extractAuthToken), prima ancora di inoltrare la richiesta a
 * un servizio a valle: una richiesta senza token valido non raggiunge mai
 * account-service/workout-service/ecc. Non sostituisce la verifica che ogni
 * servizio fa gia' per conto proprio (deve comunque decodificare `sub` per
 * lo scoping per-utente): e' un livello in piu' (difesa in profondita'),
 * non un'alternativa. Stile inline (nessun errors.ts/error-handler.ts): il
 * gateway non ha altra gestione errori da centralizzare.
 */
export function requireAuth(tokens: AccessTokenService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractAuthToken(req);
    if (!token) {
      req.log.warn("richiesta senza Bearer token o cookie di sessione");
      res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Autenticazione mancante (Bearer o cookie).",
      });
      return;
    }
    try {
      await tokens.verify(token);
      next();
    } catch {
      req.log.warn("token non valido o scaduto");
      res.status(401).json({ code: "UNAUTHORIZED", message: "Token non valido o scaduto." });
    }
  };
}

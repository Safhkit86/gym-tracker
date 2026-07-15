import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AccessTokenService } from "@gym-tracker/shared";

/**
 * Verifica centralizzata del Bearer JWT, prima ancora di inoltrare la
 * richiesta a un servizio a valle: una richiesta senza token valido non
 * raggiunge mai auth-service/workout-service/ecc. Non sostituisce la verifica
 * che ogni servizio fa gia' per conto proprio (deve comunque decodificare
 * `sub` per lo scoping per-utente): e' un livello in piu' (difesa in
 * profondita'), non un'alternativa. Stile inline (nessun errors.ts/
 * error-handler.ts): il gateway non ha altra gestione errori da centralizzare.
 */
export function requireAuth(tokens: AccessTokenService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const [scheme, token] = (req.header("authorization") ?? "").split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Header Authorization Bearer mancante.",
      });
      return;
    }
    try {
      await tokens.verify(token);
      next();
    } catch {
      res.status(401).json({ code: "UNAUTHORIZED", message: "Token non valido o scaduto." });
    }
  };
}

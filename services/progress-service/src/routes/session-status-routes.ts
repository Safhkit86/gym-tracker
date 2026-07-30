import { Router } from "express";
import type { AccessTokenService, SessionStatus } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { NotFoundError, UnauthorizedError } from "../errors.js";
import type { ProcessedSessionsRepository } from "../repositories/processed-sessions-repository.js";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";

/**
 * Stato dell'elaborazione asincrona di una sessione appena registrata: il
 * client (LogSessionPage.tsx) fa un breve polling qui dopo POST /sessions
 * (ora in history-service, che non calcola piu' suggerimenti sincroni) per
 * continuare a mostrare subito l'eventuale suggerimento, come prima dello
 * split dei due servizi.
 */
export function createSessionStatusRoutes(
  processedSessions: ProcessedSessionsRepository,
  progressionEvents: ProgressionEventRepository,
  tokens: AccessTokenService
): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function userId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.get("/sessions/:sessionId/status", async (req, res, next) => {
    try {
      const status = await processedSessions.findStatus(req.params.sessionId);
      if (!status) {
        // "pending" e "non esiste/non e' tuo" sono indistinguibili qui (il
        // consumer potrebbe non aver ancora scritto nulla): va bene, il
        // client smette comunque di fare polling dopo la finestra breve.
        res.status(200).json({ status: "pending", suggestions: [] } satisfies SessionStatus);
        return;
      }
      if (status.userId !== userId(req)) {
        // Stesso trattamento no-info-leak di NotFoundError altrove: non
        // rivelare che una sessione esiste ma e' di un altro utente.
        throw new NotFoundError("Sessione non trovata.");
      }
      if (!status.hadSuggestions) {
        res.status(200).json({ status: "no-suggestion", suggestions: [] } satisfies SessionStatus);
        return;
      }
      const suggestions = await progressionEvents.listByTriggeringSession(req.params.sessionId);
      res.status(200).json({ status: "with-suggestion", suggestions } satisfies SessionStatus);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

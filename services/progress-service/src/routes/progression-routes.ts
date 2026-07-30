import { Router } from "express";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";
import type { ExerciseHistoryCacheRepository } from "../repositories/exercise-history-cache-repository.js";

/** Suggerimenti di progressione generati dal motore di regole, piu' la
 *  rilevazione dell'esercizio in stallo per la Dashboard. */
export function createProgressionRoutes(
  progressionEvents: ProgressionEventRepository,
  exerciseHistoryCache: ExerciseHistoryCacheRepository,
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

  // Registrata prima di "/progression" (che qui non ha un ":id", ma resta
  // il percorso letterale piu' specifico da matchare per primo, stesso
  // accorgimento gia' usato altrove per rotte letterali vs. parametriche).
  router.get("/progression/stalled", async (req, res, next) => {
    try {
      const result = await exerciseHistoryCache.getStalledExercise(userId(req));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/progression", async (req, res, next) => {
    try {
      const exerciseId =
        typeof req.query.exerciseId === "string" ? req.query.exerciseId : undefined;
      const events = await progressionEvents.listByOwner(userId(req), exerciseId);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { StatsRepository } from "../repositories/stats-repository.js";

/** Statistiche aggregate per la Dashboard (sessioni, streak, volume, kg,
 *  calendario di costanza). */
export function createStatsRoutes(stats: StatsRepository, tokens: AccessTokenService): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function ownerId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.get("/stats", async (req, res, next) => {
    try {
      const result = await stats.getStats(ownerId(req));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";

/** Suggerimenti di progressione generati dal motore di regole. */
export function createProgressionRoutes(
  progressionEvents: ProgressionEventRepository,
  tokens: AccessTokenService
): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function ownerId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.get("/progression", async (req, res, next) => {
    try {
      const exerciseId =
        typeof req.query.exerciseId === "string" ? req.query.exerciseId : undefined;
      const events = await progressionEvents.listByOwner(ownerId(req), exerciseId);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

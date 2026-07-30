import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { ProgressionPreferencesRepository } from "../repositories/progression-preferences-repository.js";

const preferencesSchema = z.object({
  requiredConsecutiveSessions: z.number().int().min(1).max(10),
  groupingScope: z.enum(["workout", "exercise"]),
  prefillScope: z.enum(["workout", "exercise"]),
  timerSoundEnabled: z.boolean(),
});

/** Preferenze per-utente del motore di progressione (Profilo > Preferenze). */
export function createPreferencesRoutes(
  preferences: ProgressionPreferencesRepository,
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

  router.get("/me/preferences", async (req, res, next) => {
    try {
      const record = await preferences.find(userId(req));
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.put("/me/preferences", async (req, res, next) => {
    try {
      const body = preferencesSchema.parse(req.body);
      const record = await preferences.upsert(userId(req), body);
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

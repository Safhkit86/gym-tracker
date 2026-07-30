import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { AccountPreferencesRepository } from "../repositories/account-preferences-repository.js";
import { authenticate } from "../middleware/authenticate.js";

const accountPreferencesSchema = z.object({
  prefillScope: z.enum(["workout", "exercise"]),
  timerSoundEnabled: z.boolean(),
});

/** Preferenze utente non legate al motore di progressione (Profilo > Preferenze). */
export function createAccountPreferencesRoutes(
  preferences: AccountPreferencesRepository,
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

  router.get("/me/account-preferences", async (req, res, next) => {
    try {
      const record = await preferences.find(userId(req));
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.put("/me/account-preferences", async (req, res, next) => {
    try {
      const body = accountPreferencesSchema.parse(req.body);
      const record = await preferences.upsert(userId(req), body);
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

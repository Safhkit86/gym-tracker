import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { ProgressionDefaultsRepository } from "../repositories/progression-defaults-repository.js";

const acceptSchema = z.object({
  overrides: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        suggestionType: z.enum(["increase_weight", "increase_reps"]),
        value: z.number().positive(),
      })
    )
    .min(1, "Serve almeno un override."),
});

/** Override "una tantum" del prefill accettati da Registra sessione ("Accetta
 *  progressione" in Notifiche, vedi progression-defaults-repository.ts). */
export function createProgressionDefaultsRoutes(
  defaults: ProgressionDefaultsRepository,
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

  router.get("/me/progression-defaults", async (req, res, next) => {
    try {
      const records = await defaults.listByOwner(ownerId(req));
      res.status(200).json(records);
    } catch (err) {
      next(err);
    }
  });

  router.post("/me/progression-defaults", async (req, res, next) => {
    try {
      const body = acceptSchema.parse(req.body);
      await defaults.upsertMany(ownerId(req), body.overrides);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { UserMeasurementsRepository } from "../repositories/user-measurements-repository.js";
import { authenticate } from "../middleware/authenticate.js";

// Bound larghi di sanita' (fat-finger, non un vincolo clinico): tutti opzionali.
const measurementsSchema = z.object({
  heightCm: z.number().positive().max(250).nullish(),
  weightKg: z.number().positive().max(400).nullish(),
  chestCm: z.number().positive().max(300).nullish(),
  armCm: z.number().positive().max(300).nullish(),
  waistCm: z.number().positive().max(300).nullish(),
  legCm: z.number().positive().max(300).nullish(),
});

/** Misure fisiche dell'atleta (Profilo > Misure atleta): solo valore corrente. */
export function createMeasurementsRoutes(
  measurements: UserMeasurementsRepository,
  tokens: AccessTokenService
): Router {
  const router = Router();

  router.get("/me/measurements", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }
      const record = await measurements.find(claims.sub);
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.put("/me/measurements", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }
      const body = measurementsSchema.parse(req.body);
      const record = await measurements.upsert(claims.sub, {
        heightCm: body.heightCm ?? null,
        weightKg: body.weightKg ?? null,
        chestCm: body.chestCm ?? null,
        armCm: body.armCm ?? null,
        waistCm: body.waistCm ?? null,
        legCm: body.legCm ?? null,
      });
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

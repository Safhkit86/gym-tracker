import { Router } from "express";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { NotFoundError, UnauthorizedError } from "../errors.js";
import type { MeasurementEntryRepository } from "../repositories/measurement-entry-repository.js";

/** Storico misure (Storico > Misure): sola lettura + cancellazione. Il
 *  salvataggio non passa da qui (arriva via evento `measurement-save-requested`
 *  da account-service, vedi events/measurement-events-consumer.ts). */
export function createMeasurementsRoutes(
  measurementEntries: MeasurementEntryRepository,
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

  router.get("/measurements", async (req, res, next) => {
    try {
      const list = await measurementEntries.listByOwner(userId(req));
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/measurements/:id", async (req, res, next) => {
    try {
      const deleted = await measurementEntries.delete(userId(req), req.params.id);
      if (!deleted) {
        throw new NotFoundError("Misurazione non trovata.");
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

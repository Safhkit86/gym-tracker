import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { ExerciseService } from "../domain/exercise-service.js";

const createExerciseSchema = z.object({
  name: z.string().trim().min(1, "Il nome e' obbligatorio."),
  muscleGroup: z.string().trim().min(1).nullish(),
});

/** Rotte del catalogo esercizi: elenco (globali + propri) e creazione. */
export function createExerciseRoutes(
  exercises: ExerciseService,
  tokens: AccessTokenService
): Router {
  const router = Router();
  router.use(authenticate(tokens));

  router.get("/exercises", async (req, res, next) => {
    try {
      const ownerId = req.userClaims?.sub;
      if (!ownerId) {
        throw new UnauthorizedError();
      }
      const list = await exercises.listAvailable(ownerId);
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  });

  router.post("/exercises", async (req, res, next) => {
    try {
      const ownerId = req.userClaims?.sub;
      if (!ownerId) {
        throw new UnauthorizedError();
      }
      const body = createExerciseSchema.parse(req.body);
      const created = await exercises.create(ownerId, body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

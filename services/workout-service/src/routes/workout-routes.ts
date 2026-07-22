import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { WorkoutService } from "../domain/workout-service.js";

const setSchema = z.object({
  setNumber: z.number().int().positive(),
  targetReps: z.number().int().positive(),
  targetWeight: z.number().positive().nullish(),
  restSeconds: z.number().int().nonnegative().nullish(),
});

const exerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  position: z.number().int().positive(),
  notes: z.string().trim().min(1).nullish(),
  /** Recupero dopo questo esercizio, prima del successivo (secondi). */
  restSeconds: z.number().int().nonnegative().nullish(),
  /** Incremento di progressione (kg o reps a seconda dell'esercizio); vedi @gym-tracker/shared. */
  progressionIncrement: z.number().positive().nullish(),
  sets: z
    .array(setSchema)
    .min(1, "Ogni esercizio deve avere almeno un set.")
    .refine(
      (sets) => new Set(sets.map((s) => s.setNumber)).size === sets.length,
      "I numeri dei set devono essere univoci nell'esercizio."
    ),
});

const workoutSchema = z.object({
  name: z.string().trim().min(1, "Il nome della scheda e' obbligatorio."),
  notes: z.string().trim().min(1).nullish(),
  exercises: z
    .array(exerciseSchema)
    .refine(
      (exs) => new Set(exs.map((e) => e.position)).size === exs.length,
      "Le posizioni degli esercizi devono essere univoche nella scheda."
    ),
});

const reorderSchema = z.object({
  workoutIds: z.array(z.string().uuid()).min(1, "Serve almeno un id di scheda."),
});

/** Rotte delle schede, trattate come aggregato (POST/PUT dell'intera scheda). */
export function createWorkoutRoutes(workouts: WorkoutService, tokens: AccessTokenService): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function ownerId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.post("/workouts", async (req, res, next) => {
    try {
      const body = workoutSchema.parse(req.body);
      const created = await workouts.create(ownerId(req), body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get("/workouts", async (req, res, next) => {
    try {
      const list = await workouts.list(ownerId(req));
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  });

  router.get("/workouts/:id", async (req, res, next) => {
    try {
      const detail = await workouts.get(ownerId(req), req.params.id);
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  });

  // Registrata prima di PUT /workouts/:id: altrimenti Express interpreterebbe
  // "reorder" come valore del param :id.
  router.put("/workouts/reorder", async (req, res, next) => {
    try {
      const body = reorderSchema.parse(req.body);
      await workouts.reorder(ownerId(req), body.workoutIds);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.put("/workouts/:id", async (req, res, next) => {
    try {
      const body = workoutSchema.parse(req.body);
      const updated = await workouts.replace(ownerId(req), req.params.id, body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/workouts/:id", async (req, res, next) => {
    try {
      await workouts.delete(ownerId(req), req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

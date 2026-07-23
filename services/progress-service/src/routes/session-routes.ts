import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { SessionService } from "../domain/session-service.js";

const setSchema = z
  .object({
    setNumber: z.number().int().positive(),
    /** Snapshot della prescrizione al momento del log; assente per log liberi. */
    targetMinReps: z.number().int().positive().nullish(),
    /** Snapshot della prescrizione al momento del log; assente se non era un range. */
    targetMaxReps: z.number().int().positive().nullish(),
    actualReps: z.number().int().nonnegative(),
    actualWeight: z.number().positive().nullish(),
    actualRpe: z.number().int().min(1).max(10).nullish(),
  })
  .refine(
    (set) =>
      set.targetMaxReps == null ||
      set.targetMinReps == null ||
      set.targetMaxReps >= set.targetMinReps,
    "Le rep massime devono essere maggiori o uguali alle rep minime."
  );

const exerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  exerciseName: z.string().trim().min(1),
  workoutExerciseId: z.string().uuid().nullish(),
  /** Snapshot di WorkoutExercise.progressionIncrement al momento del log. */
  progressionIncrement: z.number().positive().nullish(),
  /** Snapshot di WorkoutExercise.restSeconds al momento del log. */
  restSeconds: z.number().int().nonnegative().nullish(),
  /** Recupero effettivamente preso prima dell'esercizio successivo. */
  actualRestSeconds: z.number().int().nonnegative().nullish(),
  sets: z
    .array(setSchema)
    .min(1, "Ogni esercizio deve avere almeno un set.")
    .refine(
      (sets) => new Set(sets.map((s) => s.setNumber)).size === sets.length,
      "I numeri dei set devono essere univoci nell'esercizio."
    ),
});

const sessionSchema = z.object({
  workoutId: z.string().uuid(),
  workoutName: z.string().trim().min(1),
  /** Snapshot di Workout.notes al momento del log (non le note della sessione). */
  workoutNotes: z.string().trim().min(1).nullish(),
  performedAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().min(1).nullish(),
  exercises: z.array(exerciseSchema).min(1, "La sessione deve avere almeno un esercizio."),
});

/** Rotte delle sessioni eseguite (registrazione allenamenti + storico). */
export function createSessionRoutes(sessions: SessionService, tokens: AccessTokenService): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function ownerId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.post("/sessions", async (req, res, next) => {
    try {
      const body = sessionSchema.parse(req.body);
      const created = await sessions.logSession(ownerId(req), body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get("/sessions", async (req, res, next) => {
    try {
      const list = await sessions.list(ownerId(req));
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  });

  router.get("/sessions/:id", async (req, res, next) => {
    try {
      const detail = await sessions.get(ownerId(req), req.params.id);
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/sessions/:id", async (req, res, next) => {
    try {
      await sessions.delete(ownerId(req), req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

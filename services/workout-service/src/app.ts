import express, { type Express } from "express";
import { buildHealthStatus, type AccessTokenService } from "@gym-tracker/shared";
import { ExerciseService } from "./domain/exercise-service.js";
import { WorkoutService } from "./domain/workout-service.js";
import type { ExerciseRepository } from "./repositories/exercise-repository.js";
import type { WorkoutRepository } from "./repositories/workout-repository.js";
import { createExerciseRoutes } from "./routes/exercise-routes.js";
import { createWorkoutRoutes } from "./routes/workout-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "workout-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely); nei test sono in memoria.
 */
export interface AppDeps {
  exercises: ExerciseRepository;
  workouts: WorkoutRepository;
  tokens: AccessTokenService;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());

  const exerciseService = new ExerciseService(deps.exercises);
  const workoutService = new WorkoutService(deps.workouts, deps.exercises);

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use(createExerciseRoutes(exerciseService, deps.tokens));
  app.use(createWorkoutRoutes(workoutService, deps.tokens));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

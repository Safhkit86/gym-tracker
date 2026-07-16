import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import { InMemoryExerciseRepository } from "../src/repositories/exercise-repository.js";
import { InMemoryWorkoutRepository } from "../src/repositories/workout-repository.js";

export const TEST_JWT_SECRET = "test-secret-please-change";

const SEED_EXERCISES = [
  { name: "Panca piana", muscleGroup: "Petto" },
  { name: "Squat", muscleGroup: "Gambe" },
];

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): { app: ReturnType<typeof createApp>; deps: AppDeps } {
  const deps: AppDeps = {
    exercises: new InMemoryExerciseRepository(SEED_EXERCISES),
    workouts: new InMemoryWorkoutRepository(),
    tokens: createAccessTokenService(TEST_JWT_SECRET),
    logger: createLogger("workout-service", { level: "silent" }),
  };
  return { app: createApp(deps), deps };
}

/** Genera un Bearer token valido per un utente di test. */
export async function bearerFor(ownerId: string, email = "test@example.com"): Promise<string> {
  const tokens = createAccessTokenService(TEST_JWT_SECRET);
  return tokens.sign({ sub: ownerId, email });
}

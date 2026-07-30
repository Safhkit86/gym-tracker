import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import { InMemoryProgressionEventPublisher } from "../src/events/publisher.js";
import { InMemoryProgressionEventRepository } from "../src/repositories/progression-event-repository.js";
import { InMemoryProgressionPreferencesRepository } from "../src/repositories/progression-preferences-repository.js";
import { InMemoryProgressionDefaultsRepository } from "../src/repositories/progression-defaults-repository.js";
import { InMemoryExerciseHistoryCacheRepository } from "../src/repositories/exercise-history-cache-repository.js";
import { InMemoryProcessedSessionsRepository } from "../src/repositories/processed-sessions-repository.js";

export const TEST_JWT_SECRET = "test-secret-please-change";

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): {
  app: ReturnType<typeof createApp>;
  deps: AppDeps;
  publisher: InMemoryProgressionEventPublisher;
} {
  const progressionEvents = new InMemoryProgressionEventRepository();
  const publisher = new InMemoryProgressionEventPublisher();
  const deps: AppDeps = {
    progressionEvents,
    progressionPreferences: new InMemoryProgressionPreferencesRepository(),
    progressionDefaults: new InMemoryProgressionDefaultsRepository(),
    exerciseHistoryCache: new InMemoryExerciseHistoryCacheRepository(progressionEvents),
    processedSessions: new InMemoryProcessedSessionsRepository(),
    tokens: createAccessTokenService(TEST_JWT_SECRET),
    logger: createLogger("progress-service", { level: "silent" }),
  };
  return { app: createApp(deps), deps, publisher };
}

/** Genera un Bearer token valido per un utente di test. */
export async function bearerFor(userId: string, email = "test@example.com"): Promise<string> {
  const tokens = createAccessTokenService(TEST_JWT_SECRET);
  return tokens.sign({ sub: userId, email });
}

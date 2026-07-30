import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import { InMemorySessionEventPublisher } from "../src/events/publisher.js";
import { InMemorySessionRepository } from "../src/repositories/session-repository.js";
import { InMemoryStatsRepository } from "../src/repositories/stats-repository.js";

export const TEST_JWT_SECRET = "test-secret-please-change";

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): {
  app: ReturnType<typeof createApp>;
  deps: AppDeps;
  publisher: InMemorySessionEventPublisher;
} {
  const sessions = new InMemorySessionRepository();
  const publisher = new InMemorySessionEventPublisher();
  const deps: AppDeps = {
    sessions,
    stats: new InMemoryStatsRepository(sessions),
    publisher,
    tokens: createAccessTokenService(TEST_JWT_SECRET),
    logger: createLogger("history-service", { level: "silent" }),
  };
  return { app: createApp(deps), deps, publisher };
}

/** Genera un Bearer token valido per un utente di test. */
export async function bearerFor(userId: string, email = "test@example.com"): Promise<string> {
  const tokens = createAccessTokenService(TEST_JWT_SECRET);
  return tokens.sign({ sub: userId, email });
}

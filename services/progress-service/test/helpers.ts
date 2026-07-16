import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import { InMemoryProgressionEventPublisher } from "../src/events/publisher.js";
import { InMemoryProgressionEventRepository } from "../src/repositories/progression-event-repository.js";
import { InMemorySessionRepository } from "../src/repositories/session-repository.js";

export const TEST_JWT_SECRET = "test-secret-please-change";

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): { app: ReturnType<typeof createApp>; deps: AppDeps } {
  const deps: AppDeps = {
    sessions: new InMemorySessionRepository(),
    progressionEvents: new InMemoryProgressionEventRepository(),
    publisher: new InMemoryProgressionEventPublisher(),
    tokens: createAccessTokenService(TEST_JWT_SECRET),
    logger: createLogger("progress-service", { level: "silent" }),
  };
  return { app: createApp(deps), deps };
}

/** Genera un Bearer token valido per un utente di test. */
export async function bearerFor(ownerId: string, email = "test@example.com"): Promise<string> {
  const tokens = createAccessTokenService(TEST_JWT_SECRET);
  return tokens.sign({ sub: ownerId, email });
}

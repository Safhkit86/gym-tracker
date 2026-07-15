import { createAccessTokenService } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import { InMemoryNotificationRepository } from "../src/repositories/notification-repository.js";

export const TEST_JWT_SECRET = "test-secret-please-change";

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): { app: ReturnType<typeof createApp>; deps: AppDeps } {
  const deps: AppDeps = {
    notifications: new InMemoryNotificationRepository(),
    tokens: createAccessTokenService(TEST_JWT_SECRET),
  };
  return { app: createApp(deps), deps };
}

/** Genera un Bearer token valido per un utente di test. */
export async function bearerFor(ownerId: string, email = "test@example.com"): Promise<string> {
  const tokens = createAccessTokenService(TEST_JWT_SECRET);
  return tokens.sign({ sub: ownerId, email });
}

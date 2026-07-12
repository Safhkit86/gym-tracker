import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import type { PasswordHasher } from "../src/domain/password.js";
import { createJoseTokenService } from "../src/domain/token.js";
import { InMemoryUserRepository } from "../src/repositories/user-repository.js";

/**
 * Hasher finto, deterministico e veloce: evita di pagare il costo (voluto) di
 * argon2 nei test di flusso. L'implementazione reale e' coperta a parte.
 */
export const fakeHasher: PasswordHasher = {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  },
  async verify(hashed: string, plain: string): Promise<boolean> {
    return hashed === `hashed:${plain}`;
  },
};

export const TEST_JWT_SECRET = "test-secret-please-change";

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): { app: ReturnType<typeof createApp>; deps: AppDeps } {
  const deps: AppDeps = {
    users: new InMemoryUserRepository(),
    passwords: fakeHasher,
    tokens: createJoseTokenService({ secret: TEST_JWT_SECRET }),
  };
  return { app: createApp(deps), deps };
}

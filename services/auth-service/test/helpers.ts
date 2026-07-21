import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { AppDeps } from "../src/app.js";
import type { PasswordHasher } from "../src/domain/password.js";
import type { Mailer, MailMessage } from "../src/domain/mailer.js";
import { InMemoryUserRepository } from "../src/repositories/user-repository.js";
import { InMemoryPasswordActionTokenRepository } from "../src/repositories/password-action-token-repository.js";

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
export const TEST_WEB_APP_URL = "http://localhost:5173";

/** Mailer finto: cattura i messaggi invece di inviarli, cosi' i test possono
 * leggere il token/OTP mandato senza un vero server SMTP. */
export interface FakeMailer extends Mailer {
  sent: MailMessage[];
}

export function createFakeMailer(): FakeMailer {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message: MailMessage): Promise<void> {
      sent.push(message);
    },
  };
}

/** Estrae un token/OTP da un testo email cercando un pattern noto. */
export function extractResetToken(text: string): string {
  const match = text.match(/token=([a-f0-9]+)/);
  if (!match) {
    throw new Error("Nessun token trovato nel testo dell'email.");
  }
  return match[1];
}

export function extractOtp(text: string): string {
  const match = text.match(/conferma \(valido 10 minuti\): (\d{6})/);
  if (!match) {
    throw new Error("Nessun OTP trovato nel testo dell'email.");
  }
  return match[1];
}

/** Costruisce l'app con dipendenze in memoria e ne espone le collaboratrici. */
export function buildTestApp(): {
  app: ReturnType<typeof createApp>;
  deps: AppDeps;
  mailer: FakeMailer;
} {
  const mailer = createFakeMailer();
  const deps: AppDeps = {
    users: new InMemoryUserRepository(),
    passwordActionTokens: new InMemoryPasswordActionTokenRepository(),
    passwords: fakeHasher,
    tokens: createAccessTokenService(TEST_JWT_SECRET),
    mailer,
    webAppUrl: TEST_WEB_APP_URL,
    logger: createLogger("auth-service", { level: "silent" }),
  };
  return { app: createApp(deps), deps, mailer };
}

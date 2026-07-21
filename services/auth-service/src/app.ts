import express, { type Express } from "express";
import {
  buildHealthStatus,
  createHttpLogger,
  type AccessTokenService,
  type Logger,
} from "@gym-tracker/shared";
import { AuthService } from "./domain/auth-service.js";
import { PasswordResetService } from "./domain/password-reset-service.js";
import { PasswordChangeService } from "./domain/password-change-service.js";
import type { PasswordHasher } from "./domain/password.js";
import type { Mailer } from "./domain/mailer.js";
import type { UserRepository } from "./repositories/user-repository.js";
import type { PasswordActionTokenRepository } from "./repositories/password-action-token-repository.js";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { createMeRoutes } from "./routes/me-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "auth-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely, argon2, jose, nodemailer); nei test sono finte in memoria/con
 * segreto fisso/mailer che cattura i messaggi invece di inviarli davvero.
 */
export interface AppDeps {
  users: UserRepository;
  passwordActionTokens: PasswordActionTokenRepository;
  passwords: PasswordHasher;
  tokens: AccessTokenService;
  mailer: Mailer;
  webAppUrl: string;
  logger: Logger;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(createHttpLogger(deps.logger));
  app.use(express.json());

  const authService = new AuthService(deps.users, deps.passwords, deps.tokens);
  const passwordResetService = new PasswordResetService(
    deps.users,
    deps.passwordActionTokens,
    deps.passwords,
    deps.mailer,
    deps.webAppUrl
  );
  const passwordChangeService = new PasswordChangeService(
    deps.users,
    deps.passwordActionTokens,
    deps.passwords,
    deps.mailer
  );

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use("/auth", createAuthRoutes(authService, passwordResetService));
  app.use(createMeRoutes(deps.users, deps.tokens, passwordChangeService));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

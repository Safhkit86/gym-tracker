import express, { type Express } from "express";
import { buildHealthStatus, type AccessTokenService } from "@gym-tracker/shared";
import { AuthService } from "./domain/auth-service.js";
import type { PasswordHasher } from "./domain/password.js";
import type { UserRepository } from "./repositories/user-repository.js";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { createMeRoutes } from "./routes/me-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "auth-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely, argon2, jose); nei test sono finte in memoria/con segreto fisso.
 */
export interface AppDeps {
  users: UserRepository;
  passwords: PasswordHasher;
  tokens: AccessTokenService;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());

  const authService = new AuthService(deps.users, deps.passwords, deps.tokens);

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use("/auth", createAuthRoutes(authService));
  app.use(createMeRoutes(deps.users, deps.tokens));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

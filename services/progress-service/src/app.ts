import express, { type Express } from "express";
import { buildHealthStatus, type AccessTokenService } from "@gym-tracker/shared";
import { SessionService } from "./domain/session-service.js";
import type { ProgressionEventPublisher } from "./events/publisher.js";
import type { ProgressionEventRepository } from "./repositories/progression-event-repository.js";
import type { SessionRepository } from "./repositories/session-repository.js";
import { createProgressionRoutes } from "./routes/progression-routes.js";
import { createSessionRoutes } from "./routes/session-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "progress-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely + RabbitMQ); nei test sono in memoria.
 */
export interface AppDeps {
  sessions: SessionRepository;
  progressionEvents: ProgressionEventRepository;
  publisher: ProgressionEventPublisher;
  tokens: AccessTokenService;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());

  const sessionService = new SessionService(deps.sessions, deps.progressionEvents, deps.publisher);

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use(createSessionRoutes(sessionService, deps.tokens));
  app.use(createProgressionRoutes(deps.progressionEvents, deps.tokens));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

import express, { type Express } from "express";
import {
  buildHealthStatus,
  createHttpLogger,
  type AccessTokenService,
  type Logger,
} from "@gym-tracker/shared";
import { SessionService } from "./domain/session-service.js";
import type { SessionEventPublisher } from "./events/publisher.js";
import type { SessionRepository } from "./repositories/session-repository.js";
import type { StatsRepository } from "./repositories/stats-repository.js";
import type { MeasurementEntryRepository } from "./repositories/measurement-entry-repository.js";
import { createSessionRoutes } from "./routes/session-routes.js";
import { createStatsRoutes } from "./routes/stats-routes.js";
import { createMeasurementsRoutes } from "./routes/measurements-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "history-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely + RabbitMQ); nei test sono in memoria.
 */
export interface AppDeps {
  sessions: SessionRepository;
  stats: StatsRepository;
  measurementEntries: MeasurementEntryRepository;
  publisher: SessionEventPublisher;
  tokens: AccessTokenService;
  logger: Logger;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(createHttpLogger(deps.logger));
  app.use(express.json());

  const sessionService = new SessionService(deps.sessions, deps.publisher, deps.logger);

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use(createSessionRoutes(sessionService, deps.tokens));
  app.use(createStatsRoutes(deps.stats, deps.tokens));
  app.use(createMeasurementsRoutes(deps.measurementEntries, deps.tokens));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

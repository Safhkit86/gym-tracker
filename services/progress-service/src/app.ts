import express, { type Express } from "express";
import {
  buildHealthStatus,
  createHttpLogger,
  type AccessTokenService,
  type Logger,
} from "@gym-tracker/shared";
import type { ProgressionEventRepository } from "./repositories/progression-event-repository.js";
import type { ProgressionPreferencesRepository } from "./repositories/progression-preferences-repository.js";
import type { ProgressionDefaultsRepository } from "./repositories/progression-defaults-repository.js";
import type { ExerciseHistoryCacheRepository } from "./repositories/exercise-history-cache-repository.js";
import type { ProcessedSessionsRepository } from "./repositories/processed-sessions-repository.js";
import { createProgressionRoutes } from "./routes/progression-routes.js";
import { createPreferencesRoutes } from "./routes/preferences-routes.js";
import { createProgressionDefaultsRoutes } from "./routes/progression-defaults-routes.js";
import { createSessionStatusRoutes } from "./routes/session-status-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "progress-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely); nei test sono in memoria. Il publisher/consumer RabbitMQ non
 * passa da qui: vive solo nell'entry point reale (index.ts), come gia' oggi
 * per il publisher di progression-events.
 */
export interface AppDeps {
  progressionEvents: ProgressionEventRepository;
  progressionPreferences: ProgressionPreferencesRepository;
  progressionDefaults: ProgressionDefaultsRepository;
  exerciseHistoryCache: ExerciseHistoryCacheRepository;
  processedSessions: ProcessedSessionsRepository;
  tokens: AccessTokenService;
  logger: Logger;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(createHttpLogger(deps.logger));
  app.use(express.json());

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use(createProgressionRoutes(deps.progressionEvents, deps.exerciseHistoryCache, deps.tokens));
  app.use(createPreferencesRoutes(deps.progressionPreferences, deps.tokens));
  app.use(createProgressionDefaultsRoutes(deps.progressionDefaults, deps.tokens));
  app.use(createSessionStatusRoutes(deps.processedSessions, deps.progressionEvents, deps.tokens));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

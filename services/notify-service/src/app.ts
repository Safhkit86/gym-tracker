import express, { type Express } from "express";
import {
  buildHealthStatus,
  createHttpLogger,
  type AccessTokenService,
  type Logger,
} from "@gym-tracker/shared";
import { NotificationService } from "./domain/notification-service.js";
import type { NotificationRepository } from "./repositories/notification-repository.js";
import { createNotificationRoutes } from "./routes/notification-routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const SERVICE_NAME = "notify-service";
const SERVICE_VERSION = "0.1.0";

/**
 * Collaboratrici iniettate nell'app. In produzione sono implementazioni reali
 * (Kysely); nei test sono in memoria. Il consumer RabbitMQ vive fuori
 * dall'app HTTP (avviato separatamente in index.ts): non serve nei test delle
 * rotte REST.
 */
export interface AppDeps {
  notifications: NotificationRepository;
  tokens: AccessTokenService;
  logger: Logger;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(createHttpLogger(deps.logger));
  app.use(express.json());

  const notificationService = new NotificationService(deps.notifications);

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use(createNotificationRoutes(notificationService, deps.tokens));

  // Error handler: registrato per ultimo, mappa gli errori in ApiError.
  app.use(errorHandler);

  return app;
}

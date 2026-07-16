import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const logger = createLogger("api-gateway");

const app = createApp({
  authServiceUrl: config.AUTH_SERVICE_URL,
  workoutServiceUrl: config.WORKOUT_SERVICE_URL,
  progressServiceUrl: config.PROGRESS_SERVICE_URL,
  notifyServiceUrl: config.NOTIFY_SERVICE_URL,
  tokens: createAccessTokenService(config.JWT_SECRET),
  logger,
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "listening");
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
  });
}

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const app = createApp({
  authServiceUrl: config.AUTH_SERVICE_URL,
  workoutServiceUrl: config.WORKOUT_SERVICE_URL,
});

const server = app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api-gateway] listening on port ${config.PORT}`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
  });
}

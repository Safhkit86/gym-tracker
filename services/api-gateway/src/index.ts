import { readFileSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const logger = createLogger("api-gateway");

const app = createApp({
  accountServiceUrl: config.ACCOUNT_SERVICE_URL,
  workoutServiceUrl: config.WORKOUT_SERVICE_URL,
  progressServiceUrl: config.PROGRESS_SERVICE_URL,
  historyServiceUrl: config.HISTORY_SERVICE_URL,
  notifyServiceUrl: config.NOTIFY_SERVICE_URL,
  webAppUrl: config.WEB_APP_URL,
  tokens: createAccessTokenService(config.JWT_SECRET),
  rateLimits: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    globalMax: config.RATE_LIMIT_GLOBAL_MAX,
    authMax: config.RATE_LIMIT_AUTH_MAX,
    sensitiveMax: config.RATE_LIMIT_SENSITIVE_MAX,
  },
  logger,
});

// HTTP invariato: e' quello che l'app mobile continua a usare (Bearer
// token, nessun cookie in gioco, vedi CLAUDE.md per il workflow di sviluppo
// su device reale via adb reverse). Mai disattivato, nemmeno quando
// l'HTTPS sotto e' attivo.
const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "listening (http)");
});

// Ascolto HTTPS aggiuntivo, solo se configurato (vedi config.ts): e' quello
// che la webapp usa per il login, perche' il cookie httpOnly del token
// richiede Secure (necessario per SameSite=None, dato che webapp e gateway
// restano origini diverse anche in locale — vedi infra/certs/README.md).
// Stessa istanza Express `app` di sopra, non una seconda copia: le due
// solo differiscono nel trasporto (TCP vs TLS).
let httpsServer: ReturnType<typeof createHttpsServer> | undefined;
if (config.HTTPS_PORT && config.HTTPS_CERT_PATH && config.HTTPS_KEY_PATH) {
  const credentials = {
    cert: readFileSync(config.HTTPS_CERT_PATH),
    key: readFileSync(config.HTTPS_KEY_PATH),
  };
  httpsServer = createHttpsServer(credentials, app).listen(config.HTTPS_PORT, () => {
    logger.info({ port: config.HTTPS_PORT }, "listening (https)");
  });
} else {
  logger.warn(
    {},
    "HTTPS_PORT/HTTPS_CERT_PATH/HTTPS_KEY_PATH non impostate: nessun listener HTTPS, il login web via cookie non funzionera'"
  );
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
    httpsServer?.close();
  });
}

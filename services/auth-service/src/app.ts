import express, { type Express } from "express";
import { buildHealthStatus } from "@gym-tracker/shared";

const SERVICE_NAME = "auth-service";
const SERVICE_VERSION = "0.1.0";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  // Placeholder: gli endpoint reali (register, login, refresh, ecc.)
  // arriveranno quando implementeremo la logica di autenticazione.
  app.get("/", (_req, res) => {
    res.json({ service: SERVICE_NAME, message: "auth-service is alive" });
  });

  return app;
}

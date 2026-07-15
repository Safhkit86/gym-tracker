import express, { type Express, type Request } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildHealthStatus } from "@gym-tracker/shared";

const SERVICE_NAME = "api-gateway";
const SERVICE_VERSION = "0.1.0";

/**
 * URL degli upstream a cui il gateway inoltra le richieste. Iniettati cosi'
 * i test possono puntare a server finti invece che ai servizi reali.
 */
export interface AppDeps {
  authServiceUrl: string;
  workoutServiceUrl: string;
  progressServiceUrl: string;
  notifyServiceUrl: string;
}

/**
 * Crea un proxy verso `target`. Nota: niente `express.json()` a monte di
 * questo middleware nell'app: consumerebbe lo stream del body prima
 * dell'inoltro, rompendo le richieste POST/PUT.
 */
function proxyTo(target: string) {
  return createProxyMiddleware<Request>({
    target,
    changeOrigin: true,
    // Express toglie il prefisso di mount da req.url per i middleware montati
    // con app.use(prefix, ...): qui lo ripristiniamo cosi' il servizio a valle
    // riceve lo stesso path completo richiesto dal client (es. /auth/login).
    pathRewrite: (_path, req) => req.originalUrl,
    on: {
      error: (_err, _req, res) => {
        // res e' ServerResponse | net.Socket: sui socket grezzi (es. upgrade
        // websocket fallito) non c'e' nulla di sensato da scrivere come JSON.
        if (!("writeHead" in res)) {
          res.destroy();
          return;
        }
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: "UPSTREAM_UNAVAILABLE",
            message: "Il servizio a monte non e' raggiungibile.",
          })
        );
      },
    },
  });
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  // La webapp (altra origine: Vite dev su :5173, o un dominio statico in
  // produzione) chiama il gateway via fetch da browser: senza CORS le
  // richieste vengono bloccate lato client prima ancora di arrivare qui.
  // Nessun cookie in gioco (auth via Bearer token), quindi riflettere
  // l'origin e' sicuro; un allowlist esplicito arrivera' con l'hardening
  // della Fase 5.
  app.use(cors());

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  // Non proxato: e' del gateway stesso, non di un servizio a monte.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  app.use("/auth", proxyTo(deps.authServiceUrl));
  app.use("/me", proxyTo(deps.authServiceUrl));
  app.use("/exercises", proxyTo(deps.workoutServiceUrl));
  app.use("/workouts", proxyTo(deps.workoutServiceUrl));
  app.use("/sessions", proxyTo(deps.progressServiceUrl));
  app.use("/progression", proxyTo(deps.progressServiceUrl));
  app.use("/notifications", proxyTo(deps.notifyServiceUrl));

  app.use((_req, res) => {
    res.status(404).json({ code: "NOT_FOUND", message: "Rotta non trovata." });
  });

  return app;
}

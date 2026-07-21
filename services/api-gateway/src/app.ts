import express, { type Express, type Request } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  buildHealthStatus,
  createHttpLogger,
  type AccessTokenService,
  type Logger,
} from "@gym-tracker/shared";
import { requireAuth } from "./middleware/authenticate.js";
import { createRateLimiters, type RateLimitConfig } from "./rate-limit.js";

const SERVICE_NAME = "api-gateway";
const SERVICE_VERSION = "0.1.0";

/**
 * URL degli upstream a cui il gateway inoltra le richieste, piu' le
 * collaboratrici per l'hardening (Fase 5). Iniettati cosi' i test possono
 * puntare a server finti/config diverse invece che ai servizi reali.
 */
export interface AppDeps {
  authServiceUrl: string;
  workoutServiceUrl: string;
  progressServiceUrl: string;
  notifyServiceUrl: string;
  tokens: AccessTokenService;
  rateLimits?: RateLimitConfig;
  logger: Logger;
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
      error: (err, req, res) => {
        req.log.error({ err }, "servizio a monte non raggiungibile");
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

  // Primissimo middleware: assegna/riusa l'id di correlazione e logga ogni
  // richiesta. Deve stare prima di tutto il resto (CORS, rate limit, proxy)
  // cosi' anche le risposte bloccate a monte (401, 429) vengono loggate.
  app.use(createHttpLogger(deps.logger));
  // pino-http ha gia' generato/riusato l'id in `req.id`; lo scriviamo anche
  // sull'header in ingresso cosi' `proxyTo` lo inoltra automaticamente ai
  // servizi a valle (legge gli header da `req` al momento della richiesta).
  app.use((req, _res, next) => {
    req.headers["x-request-id"] = String(req.id);
    next();
  });

  // La webapp (altra origine: Vite dev su :5173, o un dominio statico in
  // produzione) chiama il gateway via fetch da browser: senza CORS le
  // richieste vengono bloccate lato client prima ancora di arrivare qui.
  // Nessun cookie in gioco (auth via Bearer token), quindi riflettere
  // l'origin e' sicuro; un allowlist esplicito resta un possibile
  // affinamento futuro, non necessario per l'hardening di questa fase.
  app.use(cors());

  // Endpoint di health check: verificato dalla pipeline CI e da Docker Compose.
  // Non proxato/non limitato/non autenticato: e' del gateway stesso, non di
  // un servizio a monte, e Docker lo interroga ogni 30s.
  app.get("/health", (_req, res) => {
    res.json(buildHealthStatus(SERVICE_NAME, SERVICE_VERSION));
  });

  const rateLimiters = createRateLimiters(deps.rateLimits);
  app.use(rateLimiters.global);

  // /auth e' pubblico per intero (nessun token ancora disponibile prima di
  // login/registrazione): oggi ci vive solo POST /auth/register e
  // POST /auth/login. Se auth-service guadagnasse in futuro una rotta da
  // proteggere sotto /auth/*, andrebbe gestita esplicitamente, non assunta
  // pubblica per prefisso.
  app.use("/auth", rateLimiters.auth, proxyTo(deps.authServiceUrl));

  // Verifica centralizzata del Bearer JWT: da qui in poi ogni rotta richiede
  // un token valido, verificato alla porta d'ingresso prima ancora di
  // raggiungere un servizio a valle (che continua comunque a verificarlo per
  // conto proprio, vedi middleware/authenticate.ts).
  app.use(requireAuth(deps.tokens));

  // Piu' stringente del generico /me: azione sensibile sul proprio account.
  // Montata prima del blanket /me qui sotto, entrambe dopo requireAuth.
  app.use("/me/password", rateLimiters.sensitive, proxyTo(deps.authServiceUrl));
  app.use("/me", proxyTo(deps.authServiceUrl));
  app.use("/exercises", proxyTo(deps.workoutServiceUrl));
  app.use("/workouts", proxyTo(deps.workoutServiceUrl));
  app.use("/sessions", proxyTo(deps.progressServiceUrl));
  app.use("/progression", proxyTo(deps.progressServiceUrl));
  app.use("/notifications", proxyTo(deps.notifyServiceUrl));

  app.use((req, res) => {
    req.log.warn("rotta non trovata");
    res.status(404).json({ code: "NOT_FOUND", message: "Rotta non trovata." });
  });

  return app;
}

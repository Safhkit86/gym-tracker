import http, { type Server } from "node:http";
import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "../src/app.js";
import type { RateLimitConfig } from "../src/rate-limit.js";

export const TEST_JWT_SECRET = "test-secret-please-change";

/** Genera un Bearer token valido per un utente di test. */
export async function bearerFor(ownerId: string, email = "test@example.com"): Promise<string> {
  const tokens = createAccessTokenService(TEST_JWT_SECRET);
  return tokens.sign({ sub: ownerId, email });
}

/**
 * Server HTTP minimale usato come finto upstream (auth-service/workout-service)
 * nei test: risponde con lo status/body configurati ed espone l'ultima
 * richiesta ricevuta (path, metodo, body) per fare asserzioni sull'inoltro.
 */
export interface FakeUpstream {
  server: Server;
  url: string;
  lastRequest: {
    method: string;
    url: string;
    body: string;
    headers: http.IncomingHttpHeaders;
  } | null;
  close(): Promise<void>;
}

export async function startFakeUpstream(
  respond: (req: http.IncomingMessage, res: http.ServerResponse) => void = (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  }
): Promise<FakeUpstream> {
  const state: FakeUpstream = {
    server: http.createServer(),
    url: "",
    lastRequest: null,
    close: () => new Promise((resolve) => state.server.close(() => resolve())),
  };

  state.server.on("request", (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      state.lastRequest = {
        method: req.method ?? "",
        url: req.url ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
        headers: req.headers,
      };
      respond(req, res);
    });
  });

  await new Promise<void>((resolve) => state.server.listen(0, "127.0.0.1", resolve));
  const address = state.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Impossibile determinare la porta del fake upstream");
  }
  state.url = `http://127.0.0.1:${address.port}`;

  return state;
}

/** Costruisce l'app del gateway puntata su quattro fake upstream. */
export async function buildTestApp(rateLimits?: RateLimitConfig): Promise<{
  app: ReturnType<typeof createApp>;
  auth: FakeUpstream;
  workout: FakeUpstream;
  progress: FakeUpstream;
  notify: FakeUpstream;
  closeAll(): Promise<void>;
}> {
  const auth = await startFakeUpstream();
  const workout = await startFakeUpstream();
  const progress = await startFakeUpstream();
  const notify = await startFakeUpstream();
  const app = createApp({
    authServiceUrl: auth.url,
    workoutServiceUrl: workout.url,
    progressServiceUrl: progress.url,
    notifyServiceUrl: notify.url,
    tokens: createAccessTokenService(TEST_JWT_SECRET),
    rateLimits,
    logger: createLogger("api-gateway", { level: "silent" }),
  });
  return {
    app,
    auth,
    workout,
    progress,
    notify,
    closeAll: async () => {
      await auth.close();
      await workout.close();
      await progress.close();
      await notify.close();
    },
  };
}

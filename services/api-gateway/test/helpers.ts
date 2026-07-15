import http, { type Server } from "node:http";
import { createApp } from "../src/app.js";

/**
 * Server HTTP minimale usato come finto upstream (auth-service/workout-service)
 * nei test: risponde con lo status/body configurati ed espone l'ultima
 * richiesta ricevuta (path, metodo, body) per fare asserzioni sull'inoltro.
 */
export interface FakeUpstream {
  server: Server;
  url: string;
  lastRequest: { method: string; url: string; body: string } | null;
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

/** Costruisce l'app del gateway puntata su tre fake upstream. */
export async function buildTestApp(): Promise<{
  app: ReturnType<typeof createApp>;
  auth: FakeUpstream;
  workout: FakeUpstream;
  progress: FakeUpstream;
  closeAll(): Promise<void>;
}> {
  const auth = await startFakeUpstream();
  const workout = await startFakeUpstream();
  const progress = await startFakeUpstream();
  const app = createApp({
    authServiceUrl: auth.url,
    workoutServiceUrl: workout.url,
    progressServiceUrl: progress.url,
  });
  return {
    app,
    auth,
    workout,
    progress,
    closeAll: async () => {
      await auth.close();
      await workout.close();
      await progress.close();
    },
  };
}

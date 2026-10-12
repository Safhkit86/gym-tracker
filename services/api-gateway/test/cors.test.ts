import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { buildTestApp, TEST_WEB_APP_URL } from "./helpers.js";

/**
 * Prima di questo fix cors() veniva chiamato senza opzioni (riflette
 * qualunque Origin): questi test verificano che ora sia limitato alla sola
 * origine configurata (webAppUrl), usando /health perche' non richiede un
 * Bearer token ne' viene proxato a un upstream — isola il comportamento di
 * cors() da tutto il resto del gateway.
 */
describe("CORS", () => {
  let closeAll: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeAll?.();
  });

  it("riflette Access-Control-Allow-Origin per l'origine configurata (webAppUrl)", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app).get("/health").set("Origin", TEST_WEB_APP_URL);

    expect(response.headers["access-control-allow-origin"]).toBe(TEST_WEB_APP_URL);
  });

  it("non riflette un'origine diversa da quella configurata (cors() con stringa statica non fa eco all'Origin della richiesta)", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app)
      .get("/health")
      .set("Origin", "https://sito-non-fidato.example");

    // cors() con un'origine statica (non una funzione) risponde sempre con
    // lo stesso valore configurato, indipendentemente dall'Origin della
    // richiesta: e' il browser del chiamante, non il server, a bloccare la
    // lettura della risposta confrontando questo header con la propria
    // origine — qui verifichiamo che il valore non sia mai quello
    // dell'origine non fidata (quindi un browser reale la bloccherebbe).
    expect(response.headers["access-control-allow-origin"]).toBe(TEST_WEB_APP_URL);
    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "https://sito-non-fidato.example"
    );
  });

  it("manda Access-Control-Allow-Credentials: true (necessario per il cookie httpOnly della webapp)", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app).get("/health").set("Origin", TEST_WEB_APP_URL);

    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});

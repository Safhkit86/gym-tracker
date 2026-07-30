import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

async function registerAndGetToken(app: ReturnType<typeof buildTestApp>["app"]): Promise<string> {
  const register = await request(app)
    .post("/auth/register")
    .send({ email: "athlete@example.com", password: "supersegreta" });
  return register.body.token as string;
}

describe("GET /me/measurements", () => {
  it("restituisce tutti i campi null se non e' mai stato salvato nulla", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .get("/me/measurements")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      heightCm: null,
      weightKg: null,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });
  });

  it("legge peso/petto/braccia/vita/gamba dalla cache Redis (alimentata da measurement-recorded)", async () => {
    const { app, deps } = buildTestApp();
    const token = await registerAndGetToken(app);

    // Simula l'arrivo dell'evento measurement-recorded da history-service
    // (in produzione la cache viene popolata solo cosi', mai scritta
    // otticamente da questa route): l'userId e' quello dell'utente appena
    // registrato, recuperabile decodificando il token.
    const [, payload] = token.split(".");
    const userId = (
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        sub: string;
      }
    ).sub;
    await deps.measurementCache.set(userId, {
      weightKg: 79.5,
      chestCm: 101,
      armCm: 36,
      waistCm: 84,
      legCm: 56,
    });

    const response = await request(app)
      .get("/me/measurements")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body).toEqual({
      heightCm: null,
      weightKg: 79.5,
      chestCm: 101,
      armCm: 36,
      waistCm: 84,
      legCm: 56,
    });
  });

  it("risponde 401 senza token", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/me/measurements");

    expect(response.status).toBe(401);
  });
});

describe("PUT /me/measurements", () => {
  it("salva l'altezza localmente, pubblica measurement-save-requested e risponde con i valori inviati", async () => {
    const { app, measurementEventPublisher } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ heightCm: 180, weightKg: 78.5, chestCm: 100, armCm: 35, waistCm: 85, legCm: 55 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      heightCm: 180,
      weightKg: 78.5,
      chestCm: 100,
      armCm: 35,
      waistCm: 85,
      legCm: 55,
    });

    expect(measurementEventPublisher.published).toHaveLength(1);
    expect(measurementEventPublisher.published[0]).toMatchObject({
      weightKg: 78.5,
      chestCm: 100,
      armCm: 35,
      waistCm: 85,
      legCm: 55,
    });
    // Nessuna data esplicita: il default e' oggi.
    expect(measurementEventPublisher.published[0].measuredOn).toBe(
      new Date().toISOString().slice(0, 10)
    );
  });

  it("pubblica la data scelta quando fornita", async () => {
    const { app, measurementEventPublisher } = buildTestApp();
    const token = await registerAndGetToken(app);

    await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 80, measuredOn: "2026-06-15" });

    expect(measurementEventPublisher.published[0].measuredOn).toBe("2026-06-15");
  });

  it("l'altezza salvata localmente resta letta anche se il publish fallisse in futuro", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ heightCm: 180 });

    const response = await request(app)
      .get("/me/measurements")
      .set("Authorization", `Bearer ${token}`);
    expect(response.body.heightCm).toBe(180);
  });

  it("nessun campo e' obbligatorio: si puo' salvare solo un sottoinsieme", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 80 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      heightCm: null,
      weightKg: 80,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });
  });

  it("risponde 400 per un valore fuori dai limiti di sanita'", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ heightCm: 999 });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("fallisce (non risponde 200) se il publish confermato non va a buon fine", async () => {
    const { app, measurementEventPublisher } = buildTestApp();
    const token = await registerAndGetToken(app);
    measurementEventPublisher.failNext = true;

    const response = await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 80 });

    expect(response.status).toBe(500);
  });

  it("risponde 401 senza token", async () => {
    const { app } = buildTestApp();

    const response = await request(app).put("/me/measurements").send({ heightCm: 180 });

    expect(response.status).toBe(401);
  });
});

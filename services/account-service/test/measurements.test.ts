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

  it("risponde 401 senza token", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/me/measurements");

    expect(response.status).toBe(401);
  });
});

describe("PUT /me/measurements", () => {
  it("salva le misure e le restituisce", async () => {
    const { app } = buildTestApp();
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

    const getResponse = await request(app)
      .get("/me/measurements")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body).toEqual(response.body);
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

  it("un salvataggio successivo sovrascrive interamente i valori precedenti", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ heightCm: 180, weightKg: 78 });

    const response = await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 76 });

    expect(response.body).toEqual({
      heightCm: null,
      weightKg: 76,
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

  it("risponde 401 senza token", async () => {
    const { app } = buildTestApp();

    const response = await request(app).put("/me/measurements").send({ heightCm: 180 });

    expect(response.status).toBe(401);
  });
});

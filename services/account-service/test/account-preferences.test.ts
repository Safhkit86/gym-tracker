import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

async function registerAndGetToken(app: ReturnType<typeof buildTestApp>["app"]): Promise<string> {
  const register = await request(app)
    .post("/auth/register")
    .send({ email: "athlete@example.com", password: "supersegreta" });
  return register.body.token as string;
}

describe("GET /me/account-preferences", () => {
  it("restituisce i default se non e' mai stato salvato nulla", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .get("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ prefillScope: "workout", timerSoundEnabled: false });
  });

  it("risponde 401 senza token", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/me/account-preferences");

    expect(response.status).toBe(401);
  });
});

describe("PUT /me/account-preferences", () => {
  it("salva le preferenze e le restituisce", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .put("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefillScope: "exercise", timerSoundEnabled: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ prefillScope: "exercise", timerSoundEnabled: true });

    const getResponse = await request(app)
      .get("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body).toEqual(response.body);
  });

  it("un salvataggio successivo sovrascrive interamente i valori precedenti", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    await request(app)
      .put("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefillScope: "exercise", timerSoundEnabled: true });

    const response = await request(app)
      .put("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefillScope: "workout", timerSoundEnabled: false });

    expect(response.body).toEqual({ prefillScope: "workout", timerSoundEnabled: false });
  });

  it("risponde 400 per un prefillScope non valido", async () => {
    const { app } = buildTestApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .put("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefillScope: "bogus", timerSoundEnabled: false });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("risponde 401 senza token", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .put("/me/account-preferences")
      .send({ prefillScope: "workout", timerSoundEnabled: false });

    expect(response.status).toBe(401);
  });
});

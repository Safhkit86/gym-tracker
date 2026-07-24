import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

describe("POST /auth/forgot-password", () => {
  it("risponde con un messaggio generico se l'account esiste", async () => {
    const { app, mailer } = buildTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "esiste@example.com", password: "supersegreta" });

    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "esiste@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBeTypeOf("string");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("esiste@example.com");
  });

  it("risponde con lo STESSO messaggio se l'account non esiste, senza inviare email", async () => {
    const { app: appExists, mailer: mailerExists } = buildTestApp();
    await request(appExists)
      .post("/auth/register")
      .send({ email: "esiste2@example.com", password: "supersegreta" });
    const existsResponse = await request(appExists)
      .post("/auth/forgot-password")
      .send({ email: "esiste2@example.com" });

    const { app: appMissing, mailer: mailerMissing } = buildTestApp();
    const missingResponse = await request(appMissing)
      .post("/auth/forgot-password")
      .send({ email: "non-esiste@example.com" });

    expect(missingResponse.status).toBe(existsResponse.status);
    expect(missingResponse.body.message).toBe(existsResponse.body.message);
    expect(mailerExists.sent).toHaveLength(1);
    expect(mailerMissing.sent).toHaveLength(0);
  });

  it("non invia una seconda email se richiesta entro il cooldown", async () => {
    const { app, mailer } = buildTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "cooldown@example.com", password: "supersegreta" });

    await request(app).post("/auth/forgot-password").send({ email: "cooldown@example.com" });
    const second = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "cooldown@example.com" });

    expect(second.status).toBe(200);
    expect(mailer.sent).toHaveLength(1);
  });

  it("rifiuta un'email non valida con 400", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "non-una-email" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

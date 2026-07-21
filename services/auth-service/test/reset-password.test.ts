import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp, extractResetToken } from "./helpers.js";

describe("POST /auth/reset-password", () => {
  it("reimposta la password e permette il login con la nuova", async () => {
    const { app, mailer } = buildTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "reset@example.com", password: "vecchiapassword" });
    await request(app).post("/auth/forgot-password").send({ email: "reset@example.com" });
    const token = extractResetToken(mailer.sent[0].text);

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token, newPassword: "nuovapassword" });

    expect(response.status).toBe(200);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "reset@example.com", password: "nuovapassword" });
    expect(login.status).toBe(200);

    const oldLogin = await request(app)
      .post("/auth/login")
      .send({ email: "reset@example.com", password: "vecchiapassword" });
    expect(oldLogin.status).toBe(401);
  });

  it("rifiuta un token gia' usato", async () => {
    const { app, mailer } = buildTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "riuso@example.com", password: "vecchiapassword" });
    await request(app).post("/auth/forgot-password").send({ email: "riuso@example.com" });
    const token = extractResetToken(mailer.sent[0].text);

    await request(app).post("/auth/reset-password").send({ token, newPassword: "primapassword" });
    const second = await request(app)
      .post("/auth/reset-password")
      .send({ token, newPassword: "secondapassword" });

    expect(second.status).toBe(400);
    expect(second.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rifiuta un token inventato", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "token-non-esistente", newPassword: "nuovapassword" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rifiuta una nuova password troppo corta con 400", async () => {
    const { app, mailer } = buildTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "debole@example.com", password: "vecchiapassword" });
    await request(app).post("/auth/forgot-password").send({ email: "debole@example.com" });
    const token = extractResetToken(mailer.sent[0].text);

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token, newPassword: "123" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

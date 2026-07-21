import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

async function registerAndLogin(
  app: ReturnType<typeof buildTestApp>["app"],
  email: string,
  password: string
) {
  const response = await request(app).post("/auth/register").send({ email, password });
  return response.body.token as string;
}

describe("POST /me/password/change-request", () => {
  it("invia un OTP via email quando la password attuale e' corretta", async () => {
    const { app, mailer } = buildTestApp();
    const token = await registerAndLogin(app, "cambio@example.com", "passwordattuale");

    const response = await request(app)
      .post("/me/password/change-request")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "passwordattuale", newPassword: "passwordnuova" });

    expect(response.status).toBe(200);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("cambio@example.com");
  });

  it("rifiuta con 400 se la password attuale e' sbagliata", async () => {
    const { app, mailer } = buildTestApp();
    const token = await registerAndLogin(app, "sbagliata@example.com", "passwordattuale");

    const response = await request(app)
      .post("/me/password/change-request")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "password-sbagliata", newPassword: "passwordnuova" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_CURRENT_PASSWORD");
    expect(mailer.sent).toHaveLength(0);
  });

  it("risponde 401 senza autenticazione", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/me/password/change-request")
      .send({ currentPassword: "x", newPassword: "passwordnuova" });

    expect(response.status).toBe(401);
  });

  it("rifiuta una nuova password troppo corta con 400", async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, "corta@example.com", "passwordattuale");

    const response = await request(app)
      .post("/me/password/change-request")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "passwordattuale", newPassword: "123" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

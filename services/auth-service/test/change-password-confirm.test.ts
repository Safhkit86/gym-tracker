import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp, extractOtp } from "./helpers.js";

async function registerAndLogin(
  app: ReturnType<typeof buildTestApp>["app"],
  email: string,
  password: string
) {
  const response = await request(app).post("/auth/register").send({ email, password });
  return response.body.token as string;
}

describe("POST /me/password/change-confirm", () => {
  it("applica la nuova password quando l'OTP e' corretto", async () => {
    const { app, mailer } = buildTestApp();
    const token = await registerAndLogin(app, "confirm@example.com", "passwordattuale");
    await request(app)
      .post("/me/password/change-request")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "passwordattuale", newPassword: "passwordnuova" });
    const otp = extractOtp(mailer.sent[0].text);

    const response = await request(app)
      .post("/me/password/change-confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp });

    expect(response.status).toBe(200);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "confirm@example.com", password: "passwordnuova" });
    expect(login.status).toBe(200);
  });

  it("rifiuta un OTP sbagliato e incrementa i tentativi", async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, "otpsbagliato@example.com", "passwordattuale");
    await request(app)
      .post("/me/password/change-request")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "passwordattuale", newPassword: "passwordnuova" });

    const response = await request(app)
      .post("/me/password/change-confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "000000" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_OTP");
  });

  it("blocca dopo 5 tentativi falliti, richiede una nuova richiesta", async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, "bloccato@example.com", "passwordattuale");
    await request(app)
      .post("/me/password/change-request")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "passwordattuale", newPassword: "passwordnuova" });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/me/password/change-confirm")
        .set("Authorization", `Bearer ${token}`)
        .send({ otp: "000000" });
    }

    const response = await request(app)
      .post("/me/password/change-confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "000000" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("NO_PENDING_PASSWORD_CHANGE");
  });

  it("risponde 400 se non c'e' nessuna richiesta di cambio in corso", async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, "nessuna@example.com", "passwordattuale");

    const response = await request(app)
      .post("/me/password/change-confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "123456" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("NO_PENDING_PASSWORD_CHANGE");
  });

  it("risponde 401 senza autenticazione", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/me/password/change-confirm").send({ otp: "123456" });

    expect(response.status).toBe(401);
  });
});

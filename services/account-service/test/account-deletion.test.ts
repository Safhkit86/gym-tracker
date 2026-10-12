import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

async function registerAndLogin(
  app: ReturnType<typeof buildTestApp>["app"]
): Promise<{ token: string; userId: string }> {
  const register = await request(app)
    .post("/auth/register")
    .send({ email: "luigi@example.com", password: "supersegreta" });
  return { token: register.body.token as string, userId: register.body.user.id as string };
}

describe("GET /me/export", () => {
  it("esporta profilo, misure e preferenze dell'utente autenticato", async () => {
    const { app } = buildTestApp();
    const { token } = await registerAndLogin(app);

    await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ heightCm: 180 });

    const response = await request(app).get("/me/export").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.profile.email).toBe("luigi@example.com");
    expect(response.body.measurements.heightCm).toBe(180);
    expect(response.body.accountPreferences).toMatchObject({ prefillScope: "workout" });
  });

  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/me/export");

    expect(response.status).toBe(401);
  });
});

describe("DELETE /me", () => {
  it("cancella l'account: 204, e il profilo non e' piu' leggibile con lo stesso token", async () => {
    const { app } = buildTestApp();
    const { token } = await registerAndLogin(app);

    const deleteResponse = await request(app).delete("/me").set("Authorization", `Bearer ${token}`);
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await request(app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(afterDelete.status).toBe(401);
  });

  it("cancella anche le misure e le preferenze salvate (non solo la riga utente)", async () => {
    const { app, deps } = buildTestApp();
    const { token, userId } = await registerAndLogin(app);

    await request(app)
      .put("/me/measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ heightCm: 175 });
    await request(app)
      .put("/me/account-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefillScope: "exercise", timerSoundEnabled: true, historicizeMeasurements: false });

    await request(app).delete("/me").set("Authorization", `Bearer ${token}`);

    // Verifica diretta sui repository (non via HTTP: dopo la cancellazione
    // il token non e' piu' valido, vedi test sopra) che le due tabelle
    // satellite siano state svuotate per questo utente, non solo la riga
    // `users` — stesso comportamento del FK ON DELETE CASCADE sul DB reale
    // (vedi migrazioni 003/004), qui esercitato esplicitamente dal
    // servizio (vedi AccountDeletionService). `find` su un record assente
    // torna i default, non un errore: per questo il confronto e' con i
    // default, non con un "null"/"not found".
    expect(await deps.measurements.find(userId)).toEqual({ heightCm: null });
    expect(await deps.accountPreferences.find(userId)).toEqual({
      prefillScope: "workout",
      timerSoundEnabled: false,
      historicizeMeasurements: true,
    });
  });

  it("pubblica UserDeletedEvent per il fan-out cross-servizio", async () => {
    const { app, accountDeletionEventPublisher } = buildTestApp();
    const { token, userId } = await registerAndLogin(app);

    await request(app).delete("/me").set("Authorization", `Bearer ${token}`);

    expect(accountDeletionEventPublisher.published).toEqual([{ userId }]);
  });

  it("la richiesta HTTP resta 204 anche se il publish dell'evento fallisce (best-effort)", async () => {
    const { app, accountDeletionEventPublisher } = buildTestApp();
    const { token } = await registerAndLogin(app);
    accountDeletionEventPublisher.failNext = true;

    const response = await request(app).delete("/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();

    const response = await request(app).delete("/me");

    expect(response.status).toBe(401);
  });
});

import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

describe("GET /me/preferences", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/me/preferences");
    expect(response.status).toBe(401);
  });

  it("restituisce i default se non e' mai stato salvato nulla", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .get("/me/preferences")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requiredConsecutiveSessions: 2,
      groupingScope: "workout",
    });
  });
});

describe("PUT /me/preferences", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .put("/me/preferences")
      .send({ requiredConsecutiveSessions: 3, groupingScope: "exercise" });
    expect(response.status).toBe(401);
  });

  it("salva le preferenze e le restituisce", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ requiredConsecutiveSessions: 3, groupingScope: "exercise" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ requiredConsecutiveSessions: 3, groupingScope: "exercise" });

    const getResponse = await request(app)
      .get("/me/preferences")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body).toEqual(response.body);
  });

  it("risponde 400 per un requiredConsecutiveSessions fuori dai limiti", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ requiredConsecutiveSessions: 0, groupingScope: "workout" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("risponde 400 per un groupingScope non valido", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ requiredConsecutiveSessions: 2, groupingScope: "scheda" });

    expect(response.status).toBe(400);
  });

  it("preferenze diverse utenti non si mescolano", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor("u1");
    const tokenB = await bearerFor("u2");

    await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ requiredConsecutiveSessions: 5, groupingScope: "exercise" });

    const responseB = await request(app)
      .get("/me/preferences")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(responseB.body).toEqual({ requiredConsecutiveSessions: 2, groupingScope: "workout" });
  });
});

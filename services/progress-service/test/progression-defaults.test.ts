import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const EXERCISE_ID = "55555555-5555-5555-5555-555555555555";
const OTHER_EXERCISE_ID = "66666666-6666-6666-6666-666666666666";

describe("GET /me/progression-defaults", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/me/progression-defaults");
    expect(response.status).toBe(401);
  });

  it("restituisce un elenco vuoto se non e' mai stato accettato nulla", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .get("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("POST /me/progression-defaults", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .post("/me/progression-defaults")
      .send({
        overrides: [{ exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 82.5 }],
      });
    expect(response.status).toBe(401);
  });

  it("salva un override e lo restituisce da GET", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`)
      .send({
        overrides: [{ exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 82.5 }],
      });

    expect(response.status).toBe(204);

    const getResponse = await request(app)
      .get("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body).toEqual([
      { exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 82.5 },
    ]);
  });

  it("accetta piu' override in una sola richiesta (accetta tutte)", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`)
      .send({
        overrides: [
          { exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 82.5 },
          { exerciseId: OTHER_EXERCISE_ID, suggestionType: "increase_reps", value: 11 },
        ],
      });

    const getResponse = await request(app)
      .get("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body).toHaveLength(2);
  });

  it("un nuovo accetta sullo stesso esercizio sovrascrive il precedente non consumato", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`)
      .send({
        overrides: [{ exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 82.5 }],
      });
    await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`)
      .send({
        overrides: [{ exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 85 }],
      });

    const getResponse = await request(app)
      .get("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body).toEqual([
      { exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 85 },
    ]);
  });

  it("risponde 400 con un array vuoto", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`)
      .send({ overrides: [] });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("risponde 400 per un suggestionType non valido", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor("u1");

    const response = await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${token}`)
      .send({ overrides: [{ exerciseId: EXERCISE_ID, suggestionType: "aumenta", value: 82.5 }] });

    expect(response.status).toBe(400);
  });

  it("override di utenti diversi non si mescolano", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor("u1");
    const tokenB = await bearerFor("u2");

    await request(app)
      .post("/me/progression-defaults")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        overrides: [{ exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 82.5 }],
      });

    const responseB = await request(app)
      .get("/me/progression-defaults")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toEqual([]);
  });
});

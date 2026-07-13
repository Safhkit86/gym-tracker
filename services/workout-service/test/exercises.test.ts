import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";

describe("GET /exercises", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/exercises");
    expect(response.status).toBe(401);
  });

  it("elenca gli esercizi globali seed", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app).get("/exercises").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const names = response.body.map((e: { name: string }) => e.name);
    expect(names).toEqual(expect.arrayContaining(["Panca piana", "Squat"]));
  });

  it("non mostra gli esercizi creati da un altro utente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Esercizio privato di A" });

    const responseB = await request(app).get("/exercises").set("Authorization", `Bearer ${tokenB}`);

    const names = responseB.body.map((e: { name: string }) => e.name);
    expect(names).not.toContain("Esercizio privato di A");
  });
});

describe("POST /exercises", () => {
  it("crea un esercizio dell'utente", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hack squat", muscleGroup: "Gambe" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Hack squat",
      muscleGroup: "Gambe",
      ownerId: OWNER_A,
    });
  });

  it("rifiuta un nome vuoto con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "  " });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rifiuta un nome duplicato per lo stesso utente con 409", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Esercizio custom" });
    const second = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Esercizio custom" });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("EXERCISE_ALREADY_EXISTS");
  });
});

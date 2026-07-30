import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const EXERCISE_ID = "55555555-5555-5555-5555-555555555555";
const SESSION_ID = "66666666-6666-6666-6666-666666666666";

describe("GET /progression", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/progression");
    expect(response.status).toBe(401);
  });

  it("elenca solo i suggerimenti dell'utente, piu' recenti prima", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await deps.progressionEvents.create({
      userId: OWNER_A,
      exerciseId: EXERCISE_ID,
      exerciseName: "Panca piana",
      triggeringSessionId: SESSION_ID,
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
      reason: "Test",
    });

    const response = await request(app).get("/progression").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      exerciseId: EXERCISE_ID,
      suggestionType: "increase_weight",
    });

    const responseB = await request(app)
      .get("/progression")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toHaveLength(0);
  });

  it("filtra per exerciseId quando fornito", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await deps.progressionEvents.create({
      userId: OWNER_A,
      exerciseId: EXERCISE_ID,
      exerciseName: "Panca piana",
      triggeringSessionId: SESSION_ID,
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
      reason: "Test",
    });

    const response = await request(app)
      .get(`/progression?exerciseId=${EXERCISE_ID}`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.body).toHaveLength(1);

    const noMatch = await request(app)
      .get("/progression?exerciseId=99999999-9999-9999-9999-999999999999")
      .set("Authorization", `Bearer ${token}`);
    expect(noMatch.body).toHaveLength(0);
  });
});

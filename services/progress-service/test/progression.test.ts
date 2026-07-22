import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const WORKOUT_ID = "33333333-3333-3333-3333-333333333333";
const EXERCISE_ID = "55555555-5555-5555-5555-555555555555";

function sessionPayload(performedAt: string) {
  return {
    workoutId: WORKOUT_ID,
    workoutName: "Push day",
    performedAt,
    exercises: [
      {
        exerciseId: EXERCISE_ID,
        exerciseName: "Panca piana",
        progressionIncrement: 2.5,
        sets: [{ setNumber: 1, targetMinReps: 10, actualReps: 10, actualWeight: 80 }],
      },
    ],
  };
}

describe("GET /progression", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/progression");
    expect(response.status).toBe(401);
  });

  it("elenca solo i suggerimenti dell'utente, piu' recenti prima", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload("2026-07-01T10:00:00.000Z"));
    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload("2026-07-08T10:00:00.000Z"));

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
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload("2026-07-01T10:00:00.000Z"));
    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload("2026-07-08T10:00:00.000Z"));

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

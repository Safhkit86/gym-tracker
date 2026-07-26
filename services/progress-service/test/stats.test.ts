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
        sets: [{ setNumber: 1, actualReps: 10, actualWeight: 80 }],
      },
    ],
  };
}

describe("GET /stats", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/stats");
    expect(response.status).toBe(401);
  });

  it("riflette le sessioni registrate e resta isolato per utente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(sessionPayload(new Date().toISOString()));

    const responseA = await request(app).get("/stats").set("Authorization", `Bearer ${tokenA}`);
    expect(responseA.status).toBe(200);
    expect(responseA.body.sessionCount).toBe(1);
    expect(responseA.body.totalKgLifted).toBe(800);
    expect(responseA.body.currentWeekVolumeByExercise).toEqual([
      { exerciseId: EXERCISE_ID, exerciseName: "Panca piana", setCount: 1, repCount: 10 },
    ]);

    const responseB = await request(app).get("/stats").set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body.sessionCount).toBe(0);
    expect(responseB.body.totalKgLifted).toBe(0);
  });
});

describe("GET /progression/stalled", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/progression/stalled");
    expect(response.status).toBe(401);
  });

  it("torna null senza alcuna sessione registrata", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const response = await request(app)
      .get("/progression/stalled")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it("segnala un esercizio loggato per l'ultima volta oltre 21 giorni fa e mai progredito", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload(fortyDaysAgo));

    const response = await request(app)
      .get("/progression/stalled")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ exerciseId: EXERCISE_ID, exerciseName: "Panca piana" });
    expect(response.body.daysSinceLastProgression).toBeGreaterThanOrEqual(40);
  });

  it("non segnala un esercizio loggato di recente", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload(new Date().toISOString()));

    const response = await request(app)
      .get("/progression/stalled")
      .set("Authorization", `Bearer ${token}`);
    expect(response.body).toBeNull();
  });
});

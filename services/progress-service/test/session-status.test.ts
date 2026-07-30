import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const SESSION_ID = "33333333-3333-3333-3333-333333333333";
const EXERCISE_ID = "44444444-4444-4444-4444-444444444444";

describe("GET /sessions/:sessionId/status", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get(`/sessions/${SESSION_ID}/status`);
    expect(response.status).toBe(401);
  });

  it("torna pending se il consumer non ha ancora processato la sessione", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .get(`/sessions/${SESSION_ID}/status`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "pending", suggestions: [] });
  });

  it("torna no-suggestion se processata senza suggerimenti", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    await deps.processedSessions.markProcessed(SESSION_ID, OWNER_A, false);

    const response = await request(app)
      .get(`/sessions/${SESSION_ID}/status`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body).toEqual({ status: "no-suggestion", suggestions: [] });
  });

  it("torna with-suggestion coi suggerimenti generati da quella sessione", async () => {
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
      reason: "test",
    });
    await deps.processedSessions.markProcessed(SESSION_ID, OWNER_A, true);

    const response = await request(app)
      .get(`/sessions/${SESSION_ID}/status`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.status).toBe("with-suggestion");
    expect(response.body.suggestions).toHaveLength(1);
    expect(response.body.suggestions[0]).toMatchObject({ exerciseId: EXERCISE_ID });
  });

  it("torna 404 se la sessione processata e' di un altro utente", async () => {
    const { app, deps } = buildTestApp();
    const tokenB = await bearerFor(OWNER_B);
    await deps.processedSessions.markProcessed(SESSION_ID, OWNER_A, false);

    const response = await request(app)
      .get(`/sessions/${SESSION_ID}/status`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(response.status).toBe(404);
  });
});

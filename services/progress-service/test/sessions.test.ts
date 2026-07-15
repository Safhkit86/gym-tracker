import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const WORKOUT_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_WORKOUT_ID = "44444444-4444-4444-4444-444444444444";
const EXERCISE_ID = "55555555-5555-5555-5555-555555555555";

function sessionPayload(overrides: {
  workoutId?: string;
  performedAt: string;
  progressionIncrement?: number | null;
  actualWeight?: number | null;
  actualReps?: number;
  targetReps?: number | null;
}) {
  return {
    workoutId: overrides.workoutId ?? WORKOUT_ID,
    workoutName: "Push day",
    performedAt: overrides.performedAt,
    notes: "Buona sensazione",
    exercises: [
      {
        exerciseId: EXERCISE_ID,
        exerciseName: "Panca piana",
        progressionIncrement:
          overrides.progressionIncrement === undefined ? 2.5 : overrides.progressionIncrement,
        sets: [
          {
            setNumber: 1,
            targetReps: overrides.targetReps ?? 10,
            actualReps: overrides.actualReps ?? 10,
            actualWeight: overrides.actualWeight ?? 80,
          },
        ],
      },
    ],
  };
}

describe("POST /sessions", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).post("/sessions").send({});
    expect(response.status).toBe(401);
  });

  it("registra una sessione senza suggerimenti al primo log", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    expect(response.status).toBe(201);
    expect(response.body.workoutName).toBe("Push day");
    expect(response.body.exercises[0].exerciseName).toBe("Panca piana");
    expect(response.body.suggestions).toEqual([]);
  });

  it("rifiuta una sessione senza esercizi con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        workoutId: WORKOUT_ID,
        workoutName: "Push day",
        performedAt: "2026-07-01T10:00:00.000Z",
        exercises: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rifiuta numeri di set duplicati con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const payload = sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" });
    payload.exercises[0].sets.push({ ...payload.exercises[0].sets[0] });

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rifiuta reps negative con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const payload = sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" });
    payload.exercises[0].sets[0].actualReps = -1;

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("scatta un suggerimento increase_weight dopo 2 sessioni consecutive qualificanti", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const first = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));
    expect(first.body.suggestions).toEqual([]);

    const second = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z" }));

    expect(second.status).toBe(201);
    expect(second.body.suggestions).toHaveLength(1);
    expect(second.body.suggestions[0]).toMatchObject({
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
      source: "rule",
    });
    const publisher = deps.publisher as { published: unknown[] };
    expect(publisher.published).toHaveLength(1);
  });

  it("non scatta se il peso cambia tra le due sessioni", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z", actualWeight: 80 }));

    const second = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z", actualWeight: 82.5 }));

    expect(second.body.suggestions).toEqual([]);
  });

  it("non scatta se progressionIncrement non e' configurato sull'esercizio", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z", progressionIncrement: null })
      );

    const second = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z", progressionIncrement: null })
      );

    expect(second.body.suggestions).toEqual([]);
  });

  it("non scatta se le due sessioni qualificanti sono su schede diverse", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z", workoutId: WORKOUT_ID }));

    const second = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z", workoutId: OTHER_WORKOUT_ID })
      );

    expect(second.body.suggestions).toEqual([]);
  });
});

describe("GET /sessions e /sessions/:id", () => {
  let app: ReturnType<typeof buildTestApp>["app"];
  let tokenA: string;
  let tokenB: string;
  let sessionId: string;

  beforeEach(async () => {
    ({ app } = buildTestApp());
    tokenA = await bearerFor(OWNER_A);
    tokenB = await bearerFor(OWNER_B);
    const created = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));
    sessionId = created.body.id;
  });

  it("elenca solo le sessioni dell'utente, con exerciseCount", async () => {
    const response = await request(app).get("/sessions").set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ workoutName: "Push day", exerciseCount: 1 });

    const responseB = await request(app).get("/sessions").set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toHaveLength(0);
  });

  it("restituisce il dettaglio della propria sessione", async () => {
    const response = await request(app)
      .get(`/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(sessionId);
    expect(response.body.exercises[0].sets[0]).toMatchObject({ actualReps: 10, actualWeight: 80 });
  });

  it("risponde 404 (non 403) per la sessione di un altro utente", async () => {
    const response = await request(app)
      .get(`/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /sessions/:id", () => {
  it("elimina la sessione del proprietario", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const created = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    const response = await request(app)
      .delete(`/sessions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(204);

    const getAfter = await request(app)
      .get(`/sessions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getAfter.status).toBe(404);
  });

  it("risponde 404 se la sessione non e' del richiedente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);
    const created = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    const response = await request(app)
      .delete(`/sessions/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
  });
});

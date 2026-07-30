import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const WORKOUT_ID = "33333333-3333-3333-3333-333333333333";
const EXERCISE_ID = "55555555-5555-5555-5555-555555555555";

function sessionPayload(overrides: {
  performedAt: string;
  workoutId?: string;
  progressionIncrement?: number | null;
  actualWeight?: number | null;
  actualReps?: number;
}) {
  return {
    workoutId: overrides.workoutId ?? WORKOUT_ID,
    workoutName: "Push day",
    workoutNotes: "Petto + Tricipiti",
    performedAt: overrides.performedAt,
    notes: "Buona sensazione",
    exercises: [
      {
        exerciseId: EXERCISE_ID,
        exerciseName: "Panca piana",
        progressionIncrement:
          overrides.progressionIncrement === undefined ? 2.5 : overrides.progressionIncrement,
        restSeconds: 90,
        sets: [
          {
            setNumber: 1,
            targetMinReps: 10,
            actualReps: overrides.actualReps ?? 10,
            actualWeight: overrides.actualWeight === undefined ? 80 : overrides.actualWeight,
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

  it("registra una sessione e la restituisce (senza suggerimenti: valutati in modo asincrono altrove)", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    expect(response.status).toBe(201);
    expect(response.body.workoutName).toBe("Push day");
    expect(response.body.exercises[0].exerciseName).toBe("Panca piana");
    expect(response.body.suggestions).toBeUndefined();
  });

  it("pubblica session-logged con lo snapshot della sessione", async () => {
    const { app, publisher } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    expect(publisher.loggedEvents).toHaveLength(1);
    expect(publisher.loggedEvents[0]).toMatchObject({
      sessionId: response.body.id,
      userId: OWNER_A,
      workoutId: WORKOUT_ID,
      exercises: [
        {
          exerciseId: EXERCISE_ID,
          exerciseName: "Panca piana",
          progressionIncrement: 2.5,
          sets: [{ setNumber: 1, actualReps: 10, actualWeight: 80 }],
        },
      ],
    });
  });

  it("rifiuta una sessione senza esercizi con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }), exercises: [] });

    expect(response.status).toBe(400);
  });
});

describe("GET /sessions", () => {
  it("restituisce le sessioni dell'utente, piu' recenti prima", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));
    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z" }));

    const response = await request(app).get("/sessions").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].performedAt).toBe("2026-07-08T10:00:00.000Z");
  });

  it("isola le sessioni tra utenti diversi", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    const responseB = await request(app).get("/sessions").set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toEqual([]);
  });

  it("rispetta il parametro limit", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));
    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z" }));

    const response = await request(app)
      .get("/sessions?limit=1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body).toHaveLength(1);
  });
});

describe("GET /sessions/:id", () => {
  it("torna 404 per una sessione di un altro utente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    const created = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    const response = await request(app)
      .get(`/sessions/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(response.status).toBe(404);
  });
});

describe("DELETE /sessions/:id", () => {
  it("cancella la sessione e pubblica session-deleted", async () => {
    const { app, publisher } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const created = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z" }));

    const response = await request(app)
      .delete(`/sessions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(publisher.deletedEvents).toEqual([
      { sessionId: created.body.id, userId: OWNER_A, exerciseIds: [EXERCISE_ID] },
    ]);

    const getResponse = await request(app)
      .get(`/sessions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.status).toBe(404);
  });

  it("torna 404 se la sessione non esiste o non e' dell'utente", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .delete("/sessions/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});

describe("GET /sessions/exercise-history", () => {
  it("restituisce il valore massimo per sessione, dal piu' vecchio al piu' recente", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-01T10:00:00.000Z", actualWeight: 80 }));
    await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send(sessionPayload({ performedAt: "2026-07-08T10:00:00.000Z", actualWeight: 82.5 }));

    const response = await request(app)
      .get(`/sessions/exercise-history?exerciseId=${EXERCISE_ID}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        sessionId: expect.any(String),
        performedAt: "2026-07-01T10:00:00.000Z",
        value: 80,
        unit: "kg",
      },
      {
        sessionId: expect.any(String),
        performedAt: "2026-07-08T10:00:00.000Z",
        value: 82.5,
        unit: "kg",
      },
    ]);
  });

  it("richiede exerciseId con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .get("/sessions/exercise-history")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });
});

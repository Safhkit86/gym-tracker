import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";

async function getExerciseId(
  app: ReturnType<typeof buildTestApp>["app"],
  token: string,
  name: string
): Promise<string> {
  const response = await request(app).get("/exercises").set("Authorization", `Bearer ${token}`);
  const found = response.body.find((e: { name: string }) => e.name === name);
  return found.id;
}

function workoutPayload(exerciseId: string) {
  return {
    name: "Push day",
    notes: "Focus petto",
    exercises: [
      {
        exerciseId,
        position: 1,
        restSeconds: 120,
        progressionIncrement: 2.5,
        sets: [
          { setNumber: 1, targetReps: 10, targetWeight: 40, restSeconds: 90 },
          { setNumber: 2, targetReps: 8, targetWeight: 42.5, restSeconds: 90 },
        ],
      },
    ],
  };
}

describe("POST /workouts", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).post("/workouts").send({});
    expect(response.status).toBe(401);
  });

  it("crea una scheda con esercizi e set", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const exerciseId = await getExerciseId(app, token, "Panca piana");

    const response = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send(workoutPayload(exerciseId));

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Push day");
    expect(response.body.exercises).toHaveLength(1);
    expect(response.body.exercises[0]).toMatchObject({
      exerciseId,
      exerciseName: "Panca piana",
      position: 1,
      restSeconds: 120,
      progressionIncrement: 2.5,
    });
    expect(response.body.exercises[0].sets).toHaveLength(2);
    expect(response.body.exercises[0].sets[1]).toMatchObject({
      setNumber: 2,
      targetReps: 8,
      targetWeight: 42.5,
      restSeconds: 90,
    });
  });

  it("rifiuta un riferimento a un esercizio inesistente/inaccessibile con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send(workoutPayload("99999999-9999-9999-9999-999999999999"));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_EXERCISE_REFERENCE");
  });

  it("non permette di referenziare l'esercizio privato di un altro utente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    const created = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Esercizio privato A" });

    const response = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${tokenB}`)
      .send(workoutPayload(created.body.id));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_EXERCISE_REFERENCE");
  });

  it("rifiuta posizioni duplicate tra esercizi con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const exerciseId = await getExerciseId(app, token, "Panca piana");
    const squatId = await getExerciseId(app, token, "Squat");

    const payload = workoutPayload(exerciseId);
    payload.exercises.push({ ...payload.exercises[0], exerciseId: squatId, position: 1 });

    const response = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rifiuta un esercizio senza set con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const exerciseId = await getExerciseId(app, token, "Panca piana");

    const response = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scheda vuota", exercises: [{ exerciseId, position: 1, sets: [] }] });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /workouts e /workouts/:id", () => {
  let app: ReturnType<typeof buildTestApp>["app"];
  let tokenA: string;
  let tokenB: string;
  let workoutId: string;

  beforeEach(async () => {
    ({ app } = buildTestApp());
    tokenA = await bearerFor(OWNER_A);
    tokenB = await bearerFor(OWNER_B);
    const exerciseId = await getExerciseId(app, tokenA, "Panca piana");
    const created = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(workoutPayload(exerciseId));
    workoutId = created.body.id;
  });

  it("elenca solo le schede dell'utente", async () => {
    const response = await request(app).get("/workouts").set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ name: "Push day", exerciseCount: 1 });

    const responseB = await request(app).get("/workouts").set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toHaveLength(0);
  });

  it("restituisce il dettaglio della propria scheda", async () => {
    const response = await request(app)
      .get(`/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(workoutId);
  });

  it("risponde 404 (non 403) per la scheda di un altro utente", async () => {
    const response = await request(app)
      .get(`/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("risponde 404 per un id inesistente", async () => {
    const response = await request(app)
      .get("/workouts/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(404);
  });
});

describe("PUT /workouts/:id", () => {
  it("sostituisce l'intera scheda del proprietario", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const pancaId = await getExerciseId(app, token, "Panca piana");
    const squatId = await getExerciseId(app, token, "Squat");

    const created = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send(workoutPayload(pancaId));

    const updated = await request(app)
      .put(`/workouts/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(workoutPayload(squatId));

    expect(updated.status).toBe(200);
    expect(updated.body.exercises[0].exerciseId).toBe(squatId);
    expect(updated.body.exercises).toHaveLength(1);
  });

  it("risponde 404 se la scheda non e' del richiedente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);
    const exerciseId = await getExerciseId(app, tokenA, "Panca piana");

    const created = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(workoutPayload(exerciseId));

    const response = await request(app)
      .put(`/workouts/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send(workoutPayload(exerciseId));

    expect(response.status).toBe(404);
  });
});

describe("PUT /workouts/reorder", () => {
  async function createThreeWorkouts(
    app: ReturnType<typeof buildTestApp>["app"],
    token: string
  ): Promise<string[]> {
    const exerciseId = await getExerciseId(app, token, "Panca piana");
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const created = await request(app)
        .post("/workouts")
        .set("Authorization", `Bearer ${token}`)
        .send(workoutPayload(exerciseId));
      ids.push(created.body.id);
    }
    return ids;
  }

  it("riordina le schede secondo l'array fornito", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const [first, second, third] = await createThreeWorkouts(app, token);

    const reordered = await request(app)
      .put("/workouts/reorder")
      .set("Authorization", `Bearer ${token}`)
      .send({ workoutIds: [third, first, second] });
    expect(reordered.status).toBe(204);

    const list = await request(app).get("/workouts").set("Authorization", `Bearer ${token}`);
    expect(list.body.map((w: { id: string }) => w.id)).toEqual([third, first, second]);
  });

  it("risponde 404 se un id non e' del richiedente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);
    const [first, second] = await createThreeWorkouts(app, tokenA);

    const response = await request(app)
      .put("/workouts/reorder")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ workoutIds: [first, second] });
    expect(response.status).toBe(404);
  });

  it("risponde 404 se manca uno degli id delle schede dell'utente", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const [first, second] = await createThreeWorkouts(app, token);

    const response = await request(app)
      .put("/workouts/reorder")
      .set("Authorization", `Bearer ${token}`)
      .send({ workoutIds: [first, second] });
    expect(response.status).toBe(404);
  });

  it("rifiuta un array vuoto con 400", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .put("/workouts/reorder")
      .set("Authorization", `Bearer ${token}`)
      .send({ workoutIds: [] });
    expect(response.status).toBe(400);
  });
});

describe("DELETE /workouts/:id", () => {
  it("elimina la scheda del proprietario", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const exerciseId = await getExerciseId(app, token, "Panca piana");
    const created = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send(workoutPayload(exerciseId));

    const response = await request(app)
      .delete(`/workouts/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(204);

    const getAfter = await request(app)
      .get(`/workouts/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getAfter.status).toBe(404);
  });

  it("risponde 404 se la scheda non e' del richiedente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);
    const exerciseId = await getExerciseId(app, tokenA, "Panca piana");
    const created = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(workoutPayload(exerciseId));

    const response = await request(app)
      .delete(`/workouts/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
  });
});

import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-a111-111111111111";
const OWNER_B = "22222222-2222-2222-a222-222222222222";

describe("GET /allenamenti", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/allenamenti");
    expect(response.status).toBe(401);
  });

  it("crea automaticamente un allenamento attivo alla prima scheda, senza che l'utente ne crei uno", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scheda A", notes: null, exercises: [] });

    const response = await request(app).get("/allenamenti").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      name: "Allenamento 1",
      isActive: true,
      workoutCount: 1,
    });
  });

  it("non mostra gli allenamenti di un altro utente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Massa" });

    const response = await request(app)
      .get("/allenamenti")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });
});

describe("POST /allenamenti", () => {
  it("crea un allenamento non attivo", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Definizione" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Definizione",
      isActive: false,
      workoutCount: 0,
    });
  });

  it("rifiuta un nome vuoto", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "  " });

    expect(response.status).toBe(400);
  });
});

describe("PATCH /allenamenti/:id", () => {
  it("rinomina", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const created = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Vecchio nome" });

    const response = await request(app)
      .patch(`/allenamenti/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nuovo nome" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Nuovo nome");
  });

  it("attiva un allenamento, disattivando automaticamente il precedente attivo", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    // La prima scheda crea "Allenamento 1" (attivo di default, vedi sopra).
    await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scheda A", notes: null, exercises: [] });
    const secondo = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Definizione" });

    const response = await request(app)
      .patch(`/allenamenti/${secondo.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(true);

    const list = await request(app).get("/allenamenti").set("Authorization", `Bearer ${token}`);
    const active = list.body.filter((a: { isActive: boolean }) => a.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(secondo.body.id);
  });

  it("404 su un allenamento di un altro utente", async () => {
    const { app } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);
    const createdByA = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Di A" });

    const response = await request(app)
      .patch(`/allenamenti/${createdByA.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Rubato" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /allenamenti/:id", () => {
  it("rifiuta di cancellare l'allenamento attivo", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const created = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Da attivare" });
    await request(app)
      .patch(`/allenamenti/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: true });

    const response = await request(app)
      .delete(`/allenamenti/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ALLENAMENTO_IS_ACTIVE");
  });

  it("rifiuta di cancellare un allenamento che contiene ancora schede", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    // La prima scheda crea "Allenamento 1" attivo; un secondo allenamento
    // (non attivo) riceve la scheda spostandola, cosi' il primo resta
    // cancellabile a parte l'essere attivo (testato sopra separatamente).
    const workout = await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scheda A", notes: null, exercises: [] });
    const secondo = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Vuoto per ora" });
    await request(app)
      .put(`/workouts/${workout.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scheda A", notes: null, allenamentoId: secondo.body.id, exercises: [] });

    const response = await request(app)
      .delete(`/allenamenti/${secondo.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ALLENAMENTO_NOT_EMPTY");
  });

  it("rifiuta di cancellare l'unico allenamento dell'utente anche se vuoto", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const created = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Unico" });
    await request(app)
      .patch(`/allenamenti/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: true });

    const response = await request(app)
      .delete(`/allenamenti/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ALLENAMENTO_IS_ACTIVE");
  });

  it("cancella un allenamento vuoto e non attivo", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    // Un primo allenamento attivo (creato implicitamente dalla scheda)
    // rende il secondo, vuoto, eliminabile senza violare "non l'ultimo".
    await request(app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Scheda A", notes: null, exercises: [] });
    const vuoto = await request(app)
      .post("/allenamenti")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Da eliminare" });

    const response = await request(app)
      .delete(`/allenamenti/${vuoto.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const list = await request(app).get("/allenamenti").set("Authorization", `Bearer ${token}`);
    expect(list.body.find((a: { id: string }) => a.id === vuoto.body.id)).toBeUndefined();
  });
});

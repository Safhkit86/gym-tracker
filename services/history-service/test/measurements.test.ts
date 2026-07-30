import { describe, it, expect } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";

describe("GET /measurements", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/measurements");
    expect(response.status).toBe(401);
  });

  it("elenca solo le entry dell'utente, piu' recenti prima", async () => {
    const { app, deps } = buildTestApp();
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    await deps.measurementEntries.upsert(OWNER_A, "2026-07-01", {
      weightKg: 80,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });
    await deps.measurementEntries.upsert(OWNER_A, "2026-07-15", {
      weightKg: 79.5,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });

    const responseA = await request(app)
      .get("/measurements")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(responseA.status).toBe(200);
    expect(responseA.body).toHaveLength(2);
    expect(responseA.body[0]).toMatchObject({ measuredOn: "2026-07-15", weightKg: 79.5 });
    expect(responseA.body[1]).toMatchObject({ measuredOn: "2026-07-01", weightKg: 80 });

    const responseB = await request(app)
      .get("/measurements")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toHaveLength(0);
  });
});

describe("DELETE /measurements/:id", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).delete(
      "/measurements/11111111-1111-1111-1111-111111111111"
    );
    expect(response.status).toBe(401);
  });

  it("elimina un'entry dell'utente", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);
    const entry = await deps.measurementEntries.upsert(OWNER_A, "2026-07-01", {
      weightKg: 80,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });

    const response = await request(app)
      .delete(`/measurements/${entry.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(204);

    const list = await request(app).get("/measurements").set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });

  it("torna 404 se l'entry non esiste o e' di un altro utente", async () => {
    const { app, deps } = buildTestApp();
    const tokenB = await bearerFor(OWNER_B);
    const entry = await deps.measurementEntries.upsert(OWNER_A, "2026-07-01", {
      weightKg: 80,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });

    const response = await request(app)
      .delete(`/measurements/${entry.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
  });
});

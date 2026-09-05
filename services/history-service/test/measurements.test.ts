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

  it("con page/pageSize risponde in forma paginata invece del semplice array (Storico > Misure)", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    for (const measuredOn of ["2026-07-01", "2026-07-08", "2026-07-15"]) {
      await deps.measurementEntries.upsert(OWNER_A, measuredOn, {
        weightKg: 80,
        chestCm: null,
        armCm: null,
        waistCm: null,
        legCm: null,
      });
    }

    const firstPage = await request(app)
      .get("/measurements?page=1&pageSize=2")
      .set("Authorization", `Bearer ${token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.items[0].measuredOn).toBe("2026-07-15");

    const secondPage = await request(app)
      .get("/measurements?page=2&pageSize=2")
      .set("Authorization", `Bearer ${token}`);

    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].measuredOn).toBe("2026-07-01");
  });

  it("con since filtra le misurazioni piu' vecchie della data indicata (filtri rapidi periodo)", async () => {
    const { app, deps } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    await deps.measurementEntries.upsert(OWNER_A, "2026-01-01", {
      weightKg: 82,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });
    await deps.measurementEntries.upsert(OWNER_A, "2026-07-08", {
      weightKg: 79.5,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });

    const response = await request(app)
      .get("/measurements?page=1&pageSize=20&since=2026-06-01")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.total).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].measuredOn).toBe("2026-07-08");
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

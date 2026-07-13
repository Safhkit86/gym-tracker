import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

describe("routing verso gli upstream", () => {
  let closeAll: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeAll?.();
  });

  it("inoltra POST /auth/login ad auth-service preservando path e body", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app)
      .post("/auth/login")
      .send({ email: "a@b.com", password: "supersegreta" });

    expect(response.status).toBe(200);
    expect(ctx.auth.lastRequest?.method).toBe("POST");
    expect(ctx.auth.lastRequest?.url).toBe("/auth/login");
    expect(JSON.parse(ctx.auth.lastRequest?.body ?? "{}")).toEqual({
      email: "a@b.com",
      password: "supersegreta",
    });
    expect(ctx.workout.lastRequest).toBeNull();
  });

  it("inoltra GET /me ad auth-service", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    await request(ctx.app).get("/me").set("Authorization", "Bearer xyz");

    expect(ctx.auth.lastRequest?.url).toBe("/me");
  });

  it("inoltra GET /exercises a workout-service", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    await request(ctx.app).get("/exercises").set("Authorization", "Bearer xyz");

    expect(ctx.workout.lastRequest?.url).toBe("/exercises");
    expect(ctx.auth.lastRequest).toBeNull();
  });

  it("inoltra POST /workouts a workout-service preservando il body", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    await request(ctx.app)
      .post("/workouts")
      .set("Authorization", "Bearer xyz")
      .send({ name: "Push day", exercises: [] });

    expect(ctx.workout.lastRequest?.url).toBe("/workouts");
    expect(JSON.parse(ctx.workout.lastRequest?.body ?? "{}")).toMatchObject({ name: "Push day" });
  });

  it("inoltra GET /workouts/:id preservando il path completo", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    await request(ctx.app)
      .get("/workouts/11111111-1111-1111-1111-111111111111")
      .set("Authorization", "Bearer xyz");

    expect(ctx.workout.lastRequest?.url).toBe("/workouts/11111111-1111-1111-1111-111111111111");
  });

  it("risponde 404 per una rotta non mappata a nessun servizio", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("risponde 502 se l'upstream non e' raggiungibile", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    await ctx.auth.close();

    const response = await request(ctx.app).get("/me");

    expect(response.status).toBe(502);
    expect(response.body.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

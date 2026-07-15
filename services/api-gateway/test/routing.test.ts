import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

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
    const token = await bearerFor("u1");

    await request(ctx.app).get("/me").set("Authorization", `Bearer ${token}`);

    expect(ctx.auth.lastRequest?.url).toBe("/me");
  });

  it("inoltra GET /exercises a workout-service", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app).get("/exercises").set("Authorization", `Bearer ${token}`);

    expect(ctx.workout.lastRequest?.url).toBe("/exercises");
    expect(ctx.auth.lastRequest).toBeNull();
  });

  it("inoltra POST /workouts a workout-service preservando il body", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app)
      .post("/workouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push day", exercises: [] });

    expect(ctx.workout.lastRequest?.url).toBe("/workouts");
    expect(JSON.parse(ctx.workout.lastRequest?.body ?? "{}")).toMatchObject({ name: "Push day" });
  });

  it("inoltra GET /workouts/:id preservando il path completo", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app)
      .get("/workouts/11111111-1111-1111-1111-111111111111")
      .set("Authorization", `Bearer ${token}`);

    expect(ctx.workout.lastRequest?.url).toBe("/workouts/11111111-1111-1111-1111-111111111111");
  });

  it("inoltra POST /sessions a progress-service preservando il body", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({ workoutId: "11111111-1111-1111-1111-111111111111" });

    expect(ctx.progress.lastRequest?.url).toBe("/sessions");
    expect(JSON.parse(ctx.progress.lastRequest?.body ?? "{}")).toMatchObject({
      workoutId: "11111111-1111-1111-1111-111111111111",
    });
    expect(ctx.workout.lastRequest).toBeNull();
  });

  it("inoltra GET /progression a progress-service", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app).get("/progression").set("Authorization", `Bearer ${token}`);

    expect(ctx.progress.lastRequest?.url).toBe("/progression");
    expect(ctx.workout.lastRequest).toBeNull();
    expect(ctx.auth.lastRequest).toBeNull();
  });

  it("inoltra GET /notifications a notify-service", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app).get("/notifications").set("Authorization", `Bearer ${token}`);

    expect(ctx.notify.lastRequest?.url).toBe("/notifications");
    expect(ctx.progress.lastRequest).toBeNull();
  });

  it("inoltra PATCH /notifications/:id/read a notify-service", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    await request(ctx.app)
      .patch("/notifications/11111111-1111-1111-1111-111111111111/read")
      .set("Authorization", `Bearer ${token}`);

    expect(ctx.notify.lastRequest?.url).toBe(
      "/notifications/11111111-1111-1111-1111-111111111111/read"
    );
  });

  it("risponde 404 per una rotta non mappata a nessun servizio", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    const response = await request(ctx.app)
      .get("/does-not-exist")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("risponde 502 se l'upstream non e' raggiungibile", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;
    await ctx.auth.close();
    const token = await bearerFor("u1");

    const response = await request(ctx.app).get("/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(502);
    expect(response.body.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("autenticazione centralizzata", () => {
  let closeAll: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeAll?.();
  });

  it("risponde 401 su una rotta protetta senza token", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app).get("/workouts");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
    expect(ctx.workout.lastRequest).toBeNull();
  });

  it("risponde 401 su una rotta protetta con un token invalido", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app)
      .get("/workouts")
      .set("Authorization", "Bearer non-e-un-jwt-valido");

    expect(response.status).toBe(401);
    expect(ctx.workout.lastRequest).toBeNull();
  });

  it("permette POST /auth/login e /auth/register senza token", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const login = await request(ctx.app)
      .post("/auth/login")
      .send({ email: "a@b.com", password: "supersegreta" });
    const register = await request(ctx.app)
      .post("/auth/register")
      .send({ email: "a@b.com", password: "supersegreta" });

    expect(login.status).toBe(200);
    expect(register.status).toBe(200);
  });

  it("non richiede token per /health", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app).get("/health");

    expect(response.status).toBe(200);
  });
});

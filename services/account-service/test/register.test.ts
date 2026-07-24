import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

describe("POST /auth/register", () => {
  it("crea un utente e restituisce token + utente pubblico", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/register")
      .send({ email: "mario@example.com", password: "supersegreta" });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTypeOf("string");
    expect(response.body.user).toMatchObject({ email: "mario@example.com" });
    expect(response.body.user.id).toBeTypeOf("string");
    expect(response.body.user.createdAt).toBeDefined();
    // Il password hash non deve mai comparire nella risposta.
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("normalizza l'email (trim + lowercase)", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/register")
      .send({ email: "  Mario@Example.COM ", password: "supersegreta" });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("mario@example.com");
  });

  it("rifiuta un'email duplicata con 409", async () => {
    const { app } = buildTestApp();
    const payload = { email: "dup@example.com", password: "supersegreta" };

    await request(app).post("/auth/register").send(payload);
    const second = await request(app).post("/auth/register").send(payload);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("EMAIL_ALREADY_IN_USE");
  });

  it("rifiuta una password troppo corta con 400", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/register")
      .send({ email: "corta@example.com", password: "123" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rifiuta un'email non valida con 400", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/register")
      .send({ email: "non-una-email", password: "supersegreta" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

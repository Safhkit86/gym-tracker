import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

async function registerUser(app: ReturnType<typeof buildTestApp>["app"]): Promise<void> {
  await request(app)
    .post("/auth/register")
    .send({ email: "luigi@example.com", password: "supersegreta" });
}

describe("POST /auth/login", () => {
  it("autentica con credenziali valide e restituisce un token", async () => {
    const { app } = buildTestApp();
    await registerUser(app);

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "luigi@example.com", password: "supersegreta" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTypeOf("string");
    expect(response.body.user.email).toBe("luigi@example.com");
  });

  it("accetta l'email con casing diverso", async () => {
    const { app } = buildTestApp();
    await registerUser(app);

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "LUIGI@example.com", password: "supersegreta" });

    expect(response.status).toBe(200);
  });

  it("rifiuta una password errata con 401", async () => {
    const { app } = buildTestApp();
    await registerUser(app);

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "luigi@example.com", password: "sbagliata!" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("rifiuta un utente inesistente con 401", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "nessuno@example.com", password: "supersegreta" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
  });
});

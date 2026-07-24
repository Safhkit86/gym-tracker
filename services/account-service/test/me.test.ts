import { describe, it, expect } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { buildTestApp, TEST_JWT_SECRET } from "./helpers.js";

describe("GET /me", () => {
  it("restituisce l'utente autenticato con un token valido", async () => {
    const { app } = buildTestApp();

    const register = await request(app)
      .post("/auth/register")
      .send({ email: "peach@example.com", password: "supersegreta" });
    const token = register.body.token as string;

    const response = await request(app).get("/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email: "peach@example.com" });
    expect(response.body.id).toBe(register.body.user.id);
  });

  it("risponde 401 senza header Authorization", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("risponde 401 con un token malformato", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/me").set("Authorization", "Bearer non-un-jwt");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("risponde 401 con un token firmato con un segreto diverso", async () => {
    const { app } = buildTestApp();
    const foreignToken = await new SignJWT({ email: "hacker@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("00000000-0000-0000-0000-000000000000")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("un-altro-segreto"));

    const response = await request(app).get("/me").set("Authorization", `Bearer ${foreignToken}`);

    expect(response.status).toBe(401);
  });

  it("risponde 401 se il token e' valido ma l'utente non esiste", async () => {
    const { app } = buildTestApp();
    const orphanToken = await new SignJWT({ email: "ghost@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("11111111-1111-1111-1111-111111111111")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));

    const response = await request(app).get("/me").set("Authorization", `Bearer ${orphanToken}`);

    expect(response.status).toBe(401);
  });
});

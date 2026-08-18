import { describe, it, expect } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { buildTestApp, TEST_JWT_SECRET } from "./helpers.js";

describe("POST /me/token/refresh", () => {
  it("restituisce un nuovo token valido per lo stesso utente", async () => {
    const { app } = buildTestApp();

    const register = await request(app)
      .post("/auth/register")
      .send({ email: "peach@example.com", password: "supersegreta" });
    const oldToken = register.body.token as string;

    const response = await request(app)
      .post("/me/token/refresh")
      .set("Authorization", `Bearer ${oldToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email: "peach@example.com" });
    expect(response.body.user.id).toBe(register.body.user.id);
    expect(typeof response.body.token).toBe("string");
    // Nessun controllo "deve essere diverso dal vecchio": la firma JWT e'
    // deterministica (stesso payload+iat+secret => stessa stringa), e
    // entro lo stesso secondo di test iat puo' effettivamente coincidere.
    // Cio' che conta davvero e' che il nuovo token funzioni, verificato sotto.

    // Il nuovo token deve funzionare per una richiesta autenticata come
    // qualunque altro: non solo formalmente diverso, ma davvero valido.
    const me = await request(app).get("/me").set("Authorization", `Bearer ${response.body.token}`);
    expect(me.status).toBe(200);
  });

  it("risponde 401 senza header Authorization", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/me/token/refresh");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("risponde 401 con un token malformato", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/me/token/refresh")
      .set("Authorization", "Bearer non-un-jwt");

    expect(response.status).toBe(401);
  });

  it("risponde 401 se il token e' valido ma l'utente non esiste piu'", async () => {
    const { app } = buildTestApp();
    const orphanToken = await new SignJWT({ email: "ghost@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("11111111-1111-1111-1111-111111111111")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));

    const response = await request(app)
      .post("/me/token/refresh")
      .set("Authorization", `Bearer ${orphanToken}`);

    expect(response.status).toBe(401);
  });
});

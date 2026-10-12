import { describe, it, expect } from "vitest";
import request from "supertest";
import { AUTH_COOKIE_NAME } from "@gym-tracker/shared";
import { buildTestApp } from "./helpers.js";

/**
 * La webapp (a differenza dell'app mobile, su Bearer) si affida a questo
 * cookie httpOnly per la sessione — vedi AUTH_COOKIE_NAME in
 * packages/shared/src/auth.ts e AuthProvider.tsx lato web.
 */
function getCookie(response: request.Response, name: string): string | undefined {
  const raw = response.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

/** "name=value" senza gli attributi (Path/HttpOnly/...): e' cio' che un
 *  browser vero manda nell'header Cookie di una richiesta, a differenza
 *  del Set-Cookie completo di una risposta. */
function cookieHeaderValue(fullSetCookie: string): string {
  return fullSetCookie.split(";")[0] ?? fullSetCookie;
}

describe("cookie di sessione httpOnly (webapp)", () => {
  it("POST /auth/register imposta il cookie httpOnly, Secure, SameSite=None", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/auth/register")
      .send({ email: "luigi@example.com", password: "supersegreta" });

    const cookie = getCookie(response, AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=None");
    // Nessun Domain esplicito: vedi commento su AUTH_COOKIE_NAME.
    expect(cookie).not.toContain("Domain=");
  });

  it("POST /auth/login imposta lo stesso cookie del token restituito nel body", async () => {
    const { app } = buildTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "luigi@example.com", password: "supersegreta" });

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "luigi@example.com", password: "supersegreta" });

    const cookie = getCookie(response, AUTH_COOKIE_NAME);
    expect(cookie).toContain(`${AUTH_COOKIE_NAME}=${response.body.token}`);
  });

  it("una richiesta autenticata via cookie (nessun header Authorization) funziona", async () => {
    const { app } = buildTestApp();
    const register = await request(app)
      .post("/auth/register")
      .send({ email: "luigi@example.com", password: "supersegreta" });
    const cookie = cookieHeaderValue(getCookie(register, AUTH_COOKIE_NAME) as string);

    const response = await request(app).get("/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe("luigi@example.com");
  });

  it("POST /auth/logout cancella il cookie (204, senza richiedere una sessione valida)", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/auth/logout");

    expect(response.status).toBe(204);
    const cookie = getCookie(response, AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    // clearCookie scrive un cookie scaduto (Expires nel passato / Max-Age=0),
    // non lo stesso valore del token: questo e' cio' che fa cancellare
    // effettivamente il cookie al browser.
    expect(cookie).toMatch(/Expires=|Max-Age=0/);
  });

  it("POST /me/token/refresh rinnova anche il cookie", async () => {
    const { app } = buildTestApp();
    const register = await request(app)
      .post("/auth/register")
      .send({ email: "luigi@example.com", password: "supersegreta" });
    const cookie = cookieHeaderValue(getCookie(register, AUTH_COOKIE_NAME) as string);

    const response = await request(app).post("/me/token/refresh").set("Cookie", cookie).send();

    expect(response.status).toBe(200);
    const newCookie = getCookie(response, AUTH_COOKIE_NAME);
    expect(newCookie).toContain(`${AUTH_COOKIE_NAME}=${response.body.token}`);
  });
});

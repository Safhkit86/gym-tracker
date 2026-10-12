import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

async function registerUser(app: ReturnType<typeof buildTestApp>["app"]): Promise<void> {
  await request(app)
    .post("/auth/register")
    .send({ email: "luigi@example.com", password: "supersegreta" });
}

async function failLogin(app: ReturnType<typeof buildTestApp>["app"]): Promise<request.Response> {
  return request(app)
    .post("/auth/login")
    .send({ email: "luigi@example.com", password: "sbagliata!" });
}

/**
 * Il rate limit del gateway e' per IP (vedi api-gateway/src/rate-limit.ts):
 * questi test verificano invece il lockout per ACCOUNT, indipendente
 * dall'IP del chiamante — qui ogni richiesta arriva "dalla stessa origine"
 * di supertest, ma la logica sotto test non guarda affatto l'IP.
 */
describe("lockout per account dopo troppi login falliti", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocca l'account dopo 5 tentativi falliti consecutivi, con 423", async () => {
    const { app } = buildTestApp();
    await registerUser(app);

    for (let i = 0; i < 4; i++) {
      const response = await failLogin(app);
      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_CREDENTIALS");
    }

    const fifthAttempt = await failLogin(app);
    expect(fifthAttempt.status).toBe(423);
    expect(fifthAttempt.body.code).toBe("ACCOUNT_LOCKED");
    expect(fifthAttempt.body.details.lockedUntil).toBeTypeOf("string");
  });

  it("rifiuta anche la password corretta mentre l'account e' bloccato", async () => {
    const { app } = buildTestApp();
    await registerUser(app);

    for (let i = 0; i < 5; i++) {
      await failLogin(app);
    }

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "luigi@example.com", password: "supersegreta" });

    expect(response.status).toBe(423);
    expect(response.body.code).toBe("ACCOUNT_LOCKED");
  });

  it("un login riuscito azzera il contatore dei tentativi falliti", async () => {
    const { app } = buildTestApp();
    await registerUser(app);

    for (let i = 0; i < 3; i++) {
      await failLogin(app);
    }

    const success = await request(app)
      .post("/auth/login")
      .send({ email: "luigi@example.com", password: "supersegreta" });
    expect(success.status).toBe(200);

    // Altri 4 tentativi falliti (sotto la soglia, perche' il contatore e'
    // stato azzerato dal login riuscito sopra): se non fosse stato
    // azzerato, il quarto di questi supererebbe comunque i 5 totali.
    for (let i = 0; i < 4; i++) {
      const response = await failLogin(app);
      expect(response.status).toBe(401);
    }
  });

  it("dopo la scadenza del lockout l'account si sblocca da solo, con un contatore ripartito da zero", async () => {
    vi.useFakeTimers();
    try {
      const { app } = buildTestApp();
      await registerUser(app);

      for (let i = 0; i < 5; i++) {
        await failLogin(app);
      }
      const whileLocked = await failLogin(app);
      expect(whileLocked.status).toBe(423);

      // Oltre la durata del lockout (15 minuti, vedi LOCKOUT_DURATION_MS).
      vi.advanceTimersByTime(16 * 60 * 1000);

      const afterExpiry = await failLogin(app);
      // Un solo tentativo fallito dopo la scadenza non deve ribloccare
      // subito l'account: il contatore deve essere ripartito da zero.
      expect(afterExpiry.status).toBe(401);
      expect(afterExpiry.body.code).toBe("INVALID_CREDENTIALS");

      const success = await request(app)
        .post("/auth/login")
        .send({ email: "luigi@example.com", password: "supersegreta" });
      expect(success.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

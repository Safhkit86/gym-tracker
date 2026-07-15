import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { bearerFor, buildTestApp } from "./helpers.js";

describe("rate limiting", () => {
  let closeAll: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeAll?.();
  });

  it("risponde 429 oltre il limite globale", async () => {
    const ctx = await buildTestApp({ windowMs: 60_000, globalMax: 3, authMax: 100 });
    closeAll = ctx.closeAll;
    const token = await bearerFor("u1");

    const responses = [];
    for (let i = 0; i < 4; i++) {
      responses.push(
        await request(ctx.app).get("/workouts").set("Authorization", `Bearer ${token}`)
      );
    }

    expect(responses.slice(0, 3).every((r) => r.status !== 429)).toBe(true);
    expect(responses[3].status).toBe(429);
    expect(responses[3].body.code).toBe("RATE_LIMITED");
  });

  it("risponde 429 oltre il limite specifico su /auth, anche sotto il limite globale", async () => {
    const ctx = await buildTestApp({ windowMs: 60_000, globalMax: 100, authMax: 2 });
    closeAll = ctx.closeAll;

    const responses = [];
    for (let i = 0; i < 3; i++) {
      responses.push(
        await request(ctx.app)
          .post("/auth/login")
          .send({ email: "a@b.com", password: "supersegreta" })
      );
    }

    expect(responses.slice(0, 2).every((r) => r.status !== 429)).toBe(true);
    expect(responses[2].status).toBe(429);
    expect(responses[2].body.code).toBe("RATE_LIMITED");
  });

  it("/health non e' soggetto al rate limit", async () => {
    const ctx = await buildTestApp({ windowMs: 60_000, globalMax: 1, authMax: 1 });
    closeAll = ctx.closeAll;

    const responses = [];
    for (let i = 0; i < 5; i++) {
      responses.push(await request(ctx.app).get("/health"));
    }

    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});

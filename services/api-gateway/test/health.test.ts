import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

describe("GET /health", () => {
  let closeAll: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeAll?.();
  });

  it("risponde con status ok e non viene proxata a nessun upstream", async () => {
    const ctx = await buildTestApp();
    closeAll = ctx.closeAll;

    const response = await request(ctx.app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ service: "api-gateway", status: "ok" });
    expect(ctx.auth.lastRequest).toBeNull();
    expect(ctx.workout.lastRequest).toBeNull();
  });
});

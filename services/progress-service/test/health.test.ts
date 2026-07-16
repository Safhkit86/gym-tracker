import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";

describe("GET /health", () => {
  it("risponde con status ok e il nome del servizio", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: "progress-service",
      status: "ok",
    });
    expect(response.body.timestamp).toBeDefined();
    expect(response.headers["x-request-id"]).toBeDefined();
  });
});

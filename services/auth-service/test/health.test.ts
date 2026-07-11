import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("risponde con status ok e il nome del servizio", async () => {
    const app = createApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: "auth-service",
      status: "ok",
    });
    expect(response.body.timestamp).toBeDefined();
  });
});

describe("GET /", () => {
  it("conferma che il servizio e' attivo", async () => {
    const app = createApp();

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.service).toBe("auth-service");
  });
});

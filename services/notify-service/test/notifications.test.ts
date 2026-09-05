import { describe, it, expect } from "vitest";
import request from "supertest";
import type { NewNotification } from "../src/repositories/notification-repository.js";
import { bearerFor, buildTestApp } from "./helpers.js";

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";

function notificationInput(overrides: Partial<NewNotification> = {}): NewNotification {
  return {
    userId: OWNER_A,
    exerciseId: "55555555-5555-5555-5555-555555555555",
    exerciseName: "Panca piana",
    suggestionType: "increase_weight",
    previousValue: 80,
    suggestedValue: 82.5,
    reason: "Obiettivo di ripetizioni raggiunto per 2 sessioni consecutive a 80kg.",
    triggeringSessionId: "66666666-6666-6666-6666-666666666666",
    progressionEventId: "77777777-7777-7777-7777-777777777777",
    ...overrides,
  };
}

describe("GET /notifications", () => {
  it("richiede autenticazione", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/notifications");
    expect(response.status).toBe(401);
  });

  it("elenca solo le notifiche dell'utente", async () => {
    const { app, deps } = buildTestApp();
    await deps.notifications.create(notificationInput());
    const tokenA = await bearerFor(OWNER_A);
    const tokenB = await bearerFor(OWNER_B);

    const response = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ exerciseName: "Panca piana", readAt: null });

    const responseB = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(responseB.body).toHaveLength(0);
  });

  it("filtra le non lette con ?unread=true", async () => {
    const { app, deps } = buildTestApp();
    const created = await deps.notifications.create(notificationInput());
    await deps.notifications.markRead(OWNER_A, created!.id);
    const token = await bearerFor(OWNER_A);

    const unread = await request(app)
      .get("/notifications?unread=true")
      .set("Authorization", `Bearer ${token}`);
    expect(unread.body).toHaveLength(0);

    const all = await request(app).get("/notifications").set("Authorization", `Bearer ${token}`);
    expect(all.body).toHaveLength(1);
  });

  it("con page/pageSize risponde in forma paginata invece del semplice array", async () => {
    const { app, deps } = buildTestApp();
    await deps.notifications.create(
      notificationInput({ progressionEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
    );
    await deps.notifications.create(
      notificationInput({ progressionEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" })
    );
    await deps.notifications.create(
      notificationInput({ progressionEventId: "cccccccc-cccc-cccc-cccc-cccccccccccc" })
    );
    const token = await bearerFor(OWNER_A);

    const firstPage = await request(app)
      .get("/notifications?page=1&pageSize=2")
      .set("Authorization", `Bearer ${token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(firstPage.body.items).toHaveLength(2);

    const secondPage = await request(app)
      .get("/notifications?page=2&pageSize=2")
      .set("Authorization", `Bearer ${token}`);

    expect(secondPage.body.items).toHaveLength(1);
  });

  it("combina page/pageSize con ?unread=true", async () => {
    const { app, deps } = buildTestApp();
    const read = await deps.notifications.create(
      notificationInput({ progressionEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
    );
    await deps.notifications.markRead(OWNER_A, read!.id);
    await deps.notifications.create(
      notificationInput({ progressionEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" })
    );
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .get("/notifications?page=1&pageSize=20&unread=true")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.total).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].readAt).toBeNull();
  });
});

describe("PATCH /notifications/:id/read", () => {
  it("segna una notifica come letta", async () => {
    const { app, deps } = buildTestApp();
    const created = await deps.notifications.create(notificationInput());
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .patch(`/notifications/${created!.id}/read`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(204);

    const list = await request(app).get("/notifications").set("Authorization", `Bearer ${token}`);
    expect(list.body[0].readAt).not.toBeNull();
  });

  it("risponde 404 (non 403) per la notifica di un altro utente", async () => {
    const { app, deps } = buildTestApp();
    const created = await deps.notifications.create(notificationInput());
    const tokenB = await bearerFor(OWNER_B);

    const response = await request(app)
      .patch(`/notifications/${created!.id}/read`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("risponde 404 per un id inesistente", async () => {
    const { app } = buildTestApp();
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .patch("/notifications/00000000-0000-0000-0000-000000000000/read")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});

describe("PATCH /notifications/:id/accept", () => {
  it("segna come letta la notifica accettata e le precedenti non lette dello stesso esercizio", async () => {
    const { app, deps } = buildTestApp();
    const older = await deps.notifications.create(
      notificationInput({ progressionEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
    );
    // La notifica piu' recente per un esercizio diverso non deve essere
    // toccata dalla cascata: solo lo stesso esercizio conta.
    const otherExercise = await deps.notifications.create(
      notificationInput({
        exerciseId: "88888888-8888-8888-8888-888888888888",
        progressionEventId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      })
    );
    const newer = await deps.notifications.create(
      notificationInput({ progressionEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" })
    );
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .patch(`/notifications/${newer!.id}/accept`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(204);

    const list = await request(app).get("/notifications").set("Authorization", `Bearer ${token}`);
    const byId = new Map(
      (list.body as { id: string; readAt: string | null }[]).map((n) => [n.id, n.readAt])
    );
    expect(byId.get(newer!.id)).not.toBeNull();
    expect(byId.get(older!.id)).not.toBeNull();
    expect(byId.get(otherExercise!.id)).toBeNull();
  });

  it("accettare una notifica piu' vecchia non tocca quelle piu' recenti dello stesso esercizio", async () => {
    const { app, deps } = buildTestApp();
    const older = await deps.notifications.create(
      notificationInput({ progressionEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
    );
    const newer = await deps.notifications.create(
      notificationInput({ progressionEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" })
    );
    const token = await bearerFor(OWNER_A);

    await request(app)
      .patch(`/notifications/${older!.id}/accept`)
      .set("Authorization", `Bearer ${token}`);

    const list = await request(app).get("/notifications").set("Authorization", `Bearer ${token}`);
    const byId = new Map(
      (list.body as { id: string; readAt: string | null }[]).map((n) => [n.id, n.readAt])
    );
    expect(byId.get(older!.id)).not.toBeNull();
    expect(byId.get(newer!.id)).toBeNull();
  });

  it("segnare una notifica come 'solo letta' non tocca le altre dello stesso esercizio", async () => {
    const { app, deps } = buildTestApp();
    const older = await deps.notifications.create(
      notificationInput({ progressionEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
    );
    const newer = await deps.notifications.create(
      notificationInput({ progressionEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" })
    );
    const token = await bearerFor(OWNER_A);

    await request(app)
      .patch(`/notifications/${newer!.id}/read`)
      .set("Authorization", `Bearer ${token}`);

    const list = await request(app).get("/notifications").set("Authorization", `Bearer ${token}`);
    const byId = new Map(
      (list.body as { id: string; readAt: string | null }[]).map((n) => [n.id, n.readAt])
    );
    expect(byId.get(newer!.id)).not.toBeNull();
    expect(byId.get(older!.id)).toBeNull();
  });

  it("risponde 404 (non 403) per la notifica di un altro utente", async () => {
    const { app, deps } = buildTestApp();
    const created = await deps.notifications.create(notificationInput());
    const tokenB = await bearerFor(OWNER_B);

    const response = await request(app)
      .patch(`/notifications/${created!.id}/accept`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });
});

describe("POST /notifications/read-all", () => {
  it("segna tutte le notifiche non lette dell'utente e ritorna il conteggio", async () => {
    const { app, deps } = buildTestApp();
    await deps.notifications.create(
      notificationInput({ progressionEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
    );
    await deps.notifications.create(
      notificationInput({ progressionEventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" })
    );
    const token = await bearerFor(OWNER_A);

    const response = await request(app)
      .post("/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);

    const unread = await request(app)
      .get("/notifications?unread=true")
      .set("Authorization", `Bearer ${token}`);
    expect(unread.body).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { parseProgressionEventMessage } from "../src/events/consumer.js";
import { NotificationService } from "../src/domain/notification-service.js";
import { InMemoryNotificationRepository } from "../src/repositories/notification-repository.js";

const OWNER_ID = "11111111-1111-1111-1111-111111111111";

function validMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "77777777-7777-7777-7777-777777777777",
    exerciseId: "55555555-5555-5555-5555-555555555555",
    exerciseName: "Panca piana",
    triggeringSessionId: "66666666-6666-6666-6666-666666666666",
    suggestionType: "increase_weight",
    previousValue: 80,
    suggestedValue: 82.5,
    reason: "Obiettivo di ripetizioni raggiunto per 2 sessioni consecutive a 80kg.",
    source: "rule",
    createdAt: new Date().toISOString(),
    ownerId: OWNER_ID,
    ...overrides,
  };
}

describe("parseProgressionEventMessage", () => {
  it("valida un messaggio corretto", () => {
    const raw = Buffer.from(JSON.stringify(validMessage()));
    expect(parseProgressionEventMessage(raw)).toMatchObject({
      exerciseName: "Panca piana",
      ownerId: OWNER_ID,
    });
  });

  it("lancia per un messaggio con un campo obbligatorio mancante", () => {
    const message = validMessage();
    delete message.ownerId;
    const raw = Buffer.from(JSON.stringify(message));
    expect(() => parseProgressionEventMessage(raw)).toThrow();
  });

  it("lancia per JSON non valido", () => {
    expect(() => parseProgressionEventMessage(Buffer.from("non e' json"))).toThrow();
  });
});

describe("NotificationService.handleProgressionEvent", () => {
  it("crea una notifica dal messaggio", async () => {
    const repo = new InMemoryNotificationRepository();
    const service = new NotificationService(repo);

    await service.handleProgressionEvent(validMessage() as never);

    const list = await repo.listByOwner(OWNER_ID);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ exerciseName: "Panca piana", readAt: null });
  });

  it("non duplica se lo stesso evento arriva due volte (ridelivery RabbitMQ)", async () => {
    const repo = new InMemoryNotificationRepository();
    const service = new NotificationService(repo);

    await service.handleProgressionEvent(validMessage() as never);
    await service.handleProgressionEvent(validMessage() as never);

    const list = await repo.listByOwner(OWNER_ID);
    expect(list).toHaveLength(1);
  });
});

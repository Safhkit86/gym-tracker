import { describe, it, expect } from "vitest";
import { createLogger } from "@gym-tracker/shared";
import {
  handleUserDeleted,
  type UserDeletedConsumerDeps,
} from "../src/events/user-deleted-consumer.js";
import { InMemoryNotificationRepository } from "../src/repositories/notification-repository.js";

const USER_A = "11111111-1111-1111-a111-111111111111";
const USER_B = "22222222-2222-2222-a222-222222222222";

function buildDeps(): UserDeletedConsumerDeps & {
  notifications: InMemoryNotificationRepository;
} {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("notify-service", { level: "silent" }),
    notifications: new InMemoryNotificationRepository(),
  };
}

async function seedNotification(
  notifications: InMemoryNotificationRepository,
  userId: string,
  progressionEventId: string
): Promise<void> {
  await notifications.create({
    userId,
    exerciseId: "e1",
    exerciseName: "Panca piana",
    suggestionType: "increase_weight",
    previousValue: 60,
    suggestedValue: 62.5,
    reason: "test",
    triggeringSessionId: "s1",
    progressionEventId,
  });
}

describe("handleUserDeleted", () => {
  it("cancella tutte le notifiche dell'utente", async () => {
    const deps = buildDeps();
    await seedNotification(deps.notifications, USER_A, "pe1");

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.notifications.listByOwner(USER_A)).toHaveLength(0);
  });

  it("non tocca le notifiche di un altro utente", async () => {
    const deps = buildDeps();
    await seedNotification(deps.notifications, USER_B, "pe2");

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.notifications.listByOwner(USER_B)).toHaveLength(1);
  });
});

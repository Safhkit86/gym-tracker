import { Router } from "express";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { NotificationService } from "../domain/notification-service.js";

/** Rotte delle notifiche in-app generate dagli eventi di progressione. */
export function createNotificationRoutes(
  notifications: NotificationService,
  tokens: AccessTokenService
): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function ownerId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.get("/notifications", async (req, res, next) => {
    try {
      const unreadOnly = req.query.unread === "true";
      const list = await notifications.list(ownerId(req), unreadOnly);
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/notifications/:id/read", async (req, res, next) => {
    try {
      await notifications.markRead(ownerId(req), req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post("/notifications/read-all", async (req, res, next) => {
    try {
      const count = await notifications.markAllRead(ownerId(req));
      res.status(200).json({ count });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { ApiRequestError } from "../api/client";

export function NotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await listNotifications(token);
      setNotifications(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleMarkRead(id: string): Promise<void> {
    if (!token) {
      return;
    }
    try {
      await markNotificationRead(token, id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile segnare la notifica come letta."
      );
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    if (!token) {
      return;
    }
    try {
      await markAllNotificationsRead(token);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Impossibile segnare le notifiche come lette."
      );
    }
  }

  const hasUnread = notifications?.some((n) => n.readAt === null) ?? false;

  return (
    <main>
      <h1>Notifiche</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notifications === null && !error && <p>Caricamento…</p>}
      {notifications?.length === 0 && <p>Nessuna notifica.</p>}
      {hasUnread && (
        <p>
          <button type="button" className="secondary" onClick={handleMarkAllRead}>
            Segna tutte come lette
          </button>
        </p>
      )}
      {notifications && notifications.length > 0 && (
        <ul className="workout-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.readAt === null
                  ? "card notification-item notification-item--unread"
                  : "card notification-item"
              }
            >
              <div>
                <strong>{notification.exerciseName}</strong>
                <p>{notification.reason}</p>
                <span className="workout-list__meta">
                  {new Date(notification.createdAt).toLocaleString("it-IT")}
                </span>
              </div>
              {notification.readAt === null && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleMarkRead(notification.id)}
                >
                  Segna come letta
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

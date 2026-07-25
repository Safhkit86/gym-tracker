import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { useUnreadCount } from "../notifications/useUnreadCount";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { ApiRequestError } from "../api/client";
import { IconButton } from "../components/IconButton";
import { CheckIcon } from "../components/icons";

/** "20kg -> 22kg" o "10 -> 11 rip.": entrambi i valori sono sempre presenti
 *  quando il motore genera un suggerimento, ma restiamo difensivi (stringa
 *  vuota, niente riga) se per qualche motivo mancano. */
function formatSuggestionDelta(notification: Notification): string {
  if (notification.previousValue === null || notification.suggestedValue === null) {
    return "";
  }
  const previous = Math.round(notification.previousValue * 10) / 10;
  const suggested = Math.round(notification.suggestedValue * 10) / 10;
  return notification.suggestionType === "increase_weight"
    ? `${previous}kg → ${suggested}kg`
    : `${previous} → ${suggested} rip.`;
}

export function NotificationsPage() {
  const { token } = useAuth();
  const { refreshUnreadCount } = useUnreadCount();
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
      refreshUnreadCount();
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
      refreshUnreadCount();
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
        <div className="toolbar toolbar--end">
          <IconButton
            icon={<CheckIcon />}
            label="Segna tutte come lette"
            onClick={handleMarkAllRead}
          />
        </div>
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
                {formatSuggestionDelta(notification) && (
                  <p className="notification-item__delta">{formatSuggestionDelta(notification)}</p>
                )}
                <span className="workout-list__meta">
                  {new Date(notification.createdAt).toLocaleString("it-IT")}
                </span>
              </div>
              {notification.readAt === null && (
                <IconButton
                  icon={<CheckIcon />}
                  label="Segna come letta"
                  onClick={() => handleMarkRead(notification.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

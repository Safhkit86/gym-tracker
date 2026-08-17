import { useCallback, useEffect, useState } from "react";
import type { Notification, ProgressionDefault } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { useUnreadCount } from "../notifications/useUnreadCount";
import {
  acceptNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { acceptProgressionDefaults } from "../api/profile";
import { ApiRequestError } from "../api/client";
import { IconButton } from "../components/IconButton";
import { CheckIcon, TrendingUpIcon } from "../components/icons";
import { formatSuggestionDelta, toOverride } from "../notifications/suggestion-format";

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

  async function handleAccept(notification: Notification): Promise<void> {
    if (!token) {
      return;
    }
    const override = toOverride(notification);
    if (!override) {
      return;
    }
    try {
      await acceptProgressionDefaults(token, [override]);
      await acceptNotification(token, notification.id);
      await refresh();
      refreshUnreadCount();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile accettare la progressione."
      );
    }
  }

  async function handleAcceptAll(): Promise<void> {
    if (!token || !notifications) {
      return;
    }
    const overrides = notifications
      .filter((n) => n.readAt === null)
      .map(toOverride)
      .filter((o): o is ProgressionDefault => o !== null);
    if (overrides.length === 0) {
      return;
    }
    try {
      await acceptProgressionDefaults(token, overrides);
      await markAllNotificationsRead(token);
      await refresh();
      refreshUnreadCount();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile accettare le progressioni."
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
            icon={<TrendingUpIcon />}
            label="Accetta tutte le progressioni"
            onClick={handleAcceptAll}
          />
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
                <div className="notification-item__actions">
                  <IconButton
                    icon={<TrendingUpIcon />}
                    label="Accetta progressione"
                    onClick={() => handleAccept(notification)}
                  />
                  <IconButton
                    icon={<CheckIcon />}
                    label="Segna come letta"
                    onClick={() => handleMarkRead(notification.id)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

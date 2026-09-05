import { useCallback, useEffect, useState } from "react";
import type { Notification, Paginated, ProgressionDefault } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { useUnreadCount } from "../notifications/useUnreadCount";
import {
  acceptNotification,
  listNotifications,
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { acceptProgressionDefaults } from "../api/profile";
import { ApiRequestError } from "../api/client";
import { IconButton } from "../components/IconButton";
import { Pagination } from "../components/Pagination";
import { CheckIcon, TrendingUpIcon } from "../components/icons";
import { formatSuggestionDelta, toOverride } from "../notifications/suggestion-format";

/** Stesso valore del default lato server (vedi il commento analogo in
 *  SessionHistoryPage.tsx sul perche' non e' importato da @gym-tracker/shared). */
const NOTIFICATIONS_PAGE_SIZE = 20;

export function NotificationsPage() {
  const { token } = useAuth();
  const { refreshUnreadCount } = useUnreadCount();
  // Elenco completo, non paginato: serve SOLO per "Accetta tutte le
  // progressioni" (deve considerare ogni notifica non letta dell'utente, non
  // solo quelle della pagina visibile) e per il badge "hasUnread" sotto. La
  // lista mostrata a schermo viene invece da notificationsPage (paginata).
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [notificationsPage, setNotificationsPage] = useState<Paginated<Notification> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const [full, paged] = await Promise.all([
        listNotifications(token),
        listNotificationsPage(token, { page, pageSize: NOTIFICATIONS_PAGE_SIZE }),
      ]);
      setNotifications(full);
      setNotificationsPage(paged);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    }
  }, [token, page]);

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
          {notificationsPage?.items?.map((notification) => (
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
      {notificationsPage && (
        <Pagination
          page={notificationsPage.page}
          pageSize={notificationsPage.pageSize}
          total={notificationsPage.total}
          onPageChange={setPage}
        />
      )}
    </main>
  );
}

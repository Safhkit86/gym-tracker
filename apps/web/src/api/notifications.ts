import type { Notification, Paginated } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listNotifications(token: string, unreadOnly = false): Promise<Notification[]> {
  const query = unreadOnly ? "?unread=true" : "";
  return apiRequest<Notification[]>(`/notifications${query}`, { token });
}

export interface ListNotificationsPageOptions {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

/** Pagina di notifiche per la pagina Notifiche — vedi listNotifications per
 *  la versione non paginata (badge non lette, "Accetta tutte"). */
export function listNotificationsPage(
  token: string,
  options: ListNotificationsPageOptions
): Promise<Paginated<Notification>> {
  const params = new URLSearchParams({
    page: String(options.page),
    pageSize: String(options.pageSize),
  });
  if (options.unreadOnly) {
    params.set("unread", "true");
  }
  return apiRequest<Paginated<Notification>>(`/notifications?${params.toString()}`, { token });
}

export function markNotificationRead(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH", token });
}

/** Da usare al posto di markNotificationRead quando l'azione e' "Accetta
 *  progressione" (non "Segna come letta"): il backend segna anche come
 *  lette (non accettate) le eventuali notifiche piu' vecchie non ancora
 *  lette dello stesso esercizio — vedi notify-service/notification-service.ts. */
export function acceptNotification(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/accept`, { method: "PATCH", token });
}

export function markAllNotificationsRead(token: string): Promise<{ count: number }> {
  return apiRequest<{ count: number }>("/notifications/read-all", { method: "POST", token });
}

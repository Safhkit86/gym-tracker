import type { Notification } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listNotifications(token: string, unreadOnly = false): Promise<Notification[]> {
  const query = unreadOnly ? "?unread=true" : "";
  return apiRequest<Notification[]>(`/notifications${query}`, { token });
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

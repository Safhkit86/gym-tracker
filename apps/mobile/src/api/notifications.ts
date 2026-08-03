import type { Notification } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listNotifications(token: string, unreadOnly = false): Promise<Notification[]> {
  const query = unreadOnly ? "?unread=true" : "";
  return apiRequest<Notification[]>(`/notifications${query}`, { token });
}

export function markNotificationRead(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH", token });
}

export function markAllNotificationsRead(token: string): Promise<{ count: number }> {
  return apiRequest<{ count: number }>("/notifications/read-all", { method: "POST", token });
}

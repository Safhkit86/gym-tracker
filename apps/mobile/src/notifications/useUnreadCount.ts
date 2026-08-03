import { useContext } from "react";
import { UnreadCountContext, type UnreadCountContextValue } from "./context";

export function useUnreadCount(): UnreadCountContextValue {
  const ctx = useContext(UnreadCountContext);
  if (!ctx) {
    throw new Error("useUnreadCount deve essere usato dentro <NotificationsProvider>.");
  }
  return ctx;
}

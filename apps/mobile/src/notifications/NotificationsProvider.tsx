import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { listNotifications } from "../api/notifications";
import { UnreadCountContext, type UnreadCountContextValue } from "./context";

/** Conteggio non lette condiviso tra la tab bar (badge) e le schermate che
 *  possono farlo scendere (es. NotificationsScreen, "Accetta" in
 *  DashboardScreen): senza uno stato condiviso, un'azione che segna una
 *  notifica come letta non aggiornerebbe il badge finche' non si cambia
 *  tab. Stessa logica di apps/web/src/notifications/NotificationsProvider.tsx. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback((): void => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    listNotifications(token, true)
      .then((result) => setUnreadCount(result.length))
      .catch(() => {
        /* il badge e' un'aggiunta secondaria: un fallimento qui non deve rompere la navigazione */
      });
  }, [token]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const value: UnreadCountContextValue = { unreadCount, refreshUnreadCount };

  return <UnreadCountContext.Provider value={value}>{children}</UnreadCountContext.Provider>;
}

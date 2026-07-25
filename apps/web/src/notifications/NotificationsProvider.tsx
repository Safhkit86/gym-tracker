import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { listNotifications } from "../api/notifications";
import { UnreadCountContext, type UnreadCountContextValue } from "./context";

/** Conteggio non lette condiviso tra `Layout` (badge) e le pagine che
 *  possono farlo scendere (es. `NotificationsPage`): senza uno stato
 *  condiviso, segnare una notifica come letta restando sulla pagina
 *  Notifiche non aggiornerebbe il badge finche' non si cambia rotta. */
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

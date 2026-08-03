import { createContext } from "react";

export interface UnreadCountContextValue {
  unreadCount: number;
  refreshUnreadCount: () => void;
}

export const UnreadCountContext = createContext<UnreadCountContextValue | undefined>(undefined);

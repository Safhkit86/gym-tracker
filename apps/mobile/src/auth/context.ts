import { createContext } from "react";
import type { PublicUser } from "@gym-tracker/shared";

export interface AuthContextValue {
  token: string | null;
  user: PublicUser | null;
  /** true finche' non si e' verificato se il token salvato e' ancora valido. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

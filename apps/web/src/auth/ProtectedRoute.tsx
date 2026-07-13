import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

/** Rende le rotte figlie solo se autenticato, altrimenti reindirizza a /login. */
export function ProtectedRoute() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <p>Caricamento…</p>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

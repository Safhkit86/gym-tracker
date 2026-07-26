import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useUnreadCount } from "../notifications/useUnreadCount";

/** Shell con barra di navigazione, usata dalle pagine protette. */
export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { unreadCount, refreshUnreadCount } = useUnreadCount();

  // Rete di sicurezza: ricalcola il conteggio a ogni cambio di rotta (utile
  // se e' cambiato da un'altra scheda/finestra). Il caso comune — segnare
  // una notifica come letta restando sulla pagina Notifiche — e' gestito
  // invece da NotificationsPage che chiama refreshUnreadCount() subito dopo
  // l'azione, senza aspettare una navigazione.
  useEffect(() => {
    refreshUnreadCount();
  }, [location.pathname, refreshUnreadCount]);

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav__links">
          <Link to="/" className="app-nav__brand">
            Dashboard
          </Link>
          <NavLink to="/workouts">Schede</NavLink>
          <NavLink to="/sessions">Storico</NavLink>
          <NavLink to="/notifications">
            Notifiche{unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </NavLink>
        </div>
        <div className="app-nav__links">
          {user && (
            <Link to="/profile" className="app-nav__user">
              {user.email}
            </Link>
          )}
          <button type="button" className="secondary" onClick={logout}>
            Esci
          </button>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

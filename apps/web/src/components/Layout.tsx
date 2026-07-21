import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { listNotifications } from "../api/notifications";

/** Shell con barra di navigazione, usata dalle pagine protette. */
export function Layout() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  // Il conteggio si ricalcola a ogni cambio di rotta (es. dopo aver segnato
  // una notifica come letta e navigato altrove): Layout resta montato tra le
  // pagine figlie, quindi senza questa dipendenza il badge resterebbe fermo
  // al valore del primo caricamento.
  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listNotifications(token, true)
      .then((result) => {
        if (!cancelled) {
          setUnreadCount(result.length);
        }
      })
      .catch(() => {
        /* il badge e' un'aggiunta secondaria: un fallimento qui non deve rompere la navigazione */
      });
    return () => {
      cancelled = true;
    };
  }, [token, location.pathname]);

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav__links">
          <Link to="/" className="app-nav__brand">
            gym-tracker
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

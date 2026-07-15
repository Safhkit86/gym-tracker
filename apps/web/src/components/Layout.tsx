import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

/** Shell con barra di navigazione, usata dalle pagine protette. */
export function Layout() {
  const { user, logout } = useAuth();

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav__links">
          <Link to="/" className="app-nav__brand">
            gym-tracker
          </Link>
          <Link to="/workouts">Schede</Link>
          <Link to="/sessions">Storico</Link>
        </div>
        <div className="app-nav__links">
          {user && <span className="app-nav__user">{user.email}</span>}
          <button type="button" className="secondary" onClick={logout}>
            Esci
          </button>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

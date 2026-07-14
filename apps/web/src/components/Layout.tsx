import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

/** Shell con barra di navigazione, usata dalle pagine protette. */
export function Layout() {
  const { user, logout } = useAuth();

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav__links">
          <Link to="/">
            <strong>gym-tracker</strong>
          </Link>
          <Link to="/workouts">Schede</Link>
        </div>
        <div className="app-nav__links">
          {user && <span>{user.email}</span>}
          <button type="button" className="secondary" onClick={logout}>
            Esci
          </button>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

/** Shell con barra di navigazione, usata dalle pagine protette. */
export function Layout() {
  const { user, logout } = useAuth();

  return (
    <>
      <nav className="app-nav">
        <strong>gym-tracker</strong>
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

import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <main>
      <div className="card">
        <h1>Ciao{user ? `, ${user.email}` : ""}</h1>
        {user && <p>Account creato il {new Date(user.createdAt).toLocaleDateString("it-IT")}.</p>}
        <p>
          <Link to="/workouts">Vai alle tue schede di allenamento</Link>
        </p>
      </div>
    </main>
  );
}

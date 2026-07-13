import { useAuth } from "../auth/useAuth";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <main>
      <h1>Ciao{user ? `, ${user.email}` : ""}</h1>
      {user && <p>Account creato il {new Date(user.createdAt).toLocaleDateString("it-IT")}.</p>}
      <p>Le tue schede di allenamento arriveranno con la prossima fase.</p>
    </main>
  );
}

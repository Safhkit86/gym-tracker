import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { ApiRequestError } from "../api/client";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Le due password non coincidono.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      navigate("/login", {
        replace: true,
        state: { message: "Password reimpostata: accedi con la nuova password." },
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main>
        <div className="card auth-card">
          <p role="alert" className="form-error">
            Link di reset non valido: manca il token.
          </p>
          <p>
            <Link to="/forgot-password">Richiedi un nuovo link</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="card auth-card">
        <h1>Reimposta password</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Nuova password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Conferma nuova password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvataggio…" : "Reimposta password"}
          </button>
        </form>
      </div>
    </main>
  );
}

import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { confirmPasswordChange, requestPasswordChange } from "../api/auth";
import { ApiRequestError } from "../api/client";

export function ProfilePage() {
  const { user, token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestChange(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmNewPassword) {
      setError("Le due password non coincidono.");
      return;
    }
    if (!token) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestPasswordChange(token, { currentPassword, newPassword });
      setMessage(result.message);
      setAwaitingOtp(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmChange(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!token) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmPasswordChange(token, { otp });
      setMessage(result.message);
      setAwaitingOtp(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setOtp("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) {
    return (
      <main>
        <p>Caricamento…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Profilo</h1>

      <section className="card">
        <h2>Account</h2>
        <p>Email: {user.email}</p>
        <p>Membro dal: {new Date(user.createdAt).toLocaleDateString("it-IT")}</p>
      </section>

      <section className="card">
        <h2>Sicurezza</h2>
        <p>Per cambiare password confermiamo la tua identita' in due passaggi.</p>

        {!awaitingOtp && (
          <form onSubmit={handleRequestChange}>
            <label>
              Password attuale
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
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
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
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
              {isSubmitting ? "Invio in corso…" : "Invia codice di conferma"}
            </button>
          </form>
        )}

        {awaitingOtp && (
          <form onSubmit={handleConfirmChange}>
            {message && <p role="status">{message}</p>}
            <label>
              Codice ricevuto via email
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                autoComplete="one-time-code"
                required
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="exercise-form__actions">
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Conferma in corso…" : "Conferma cambio password"}
              </button>
              <button type="button" className="secondary" onClick={() => setAwaitingOtp(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}

        {message && !awaitingOtp && <p role="status">{message}</p>}
      </section>
    </main>
  );
}

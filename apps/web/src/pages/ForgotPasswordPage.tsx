import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import { ApiRequestError } from "../api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await forgotPassword({ email });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <div className="card auth-card">
        <h1>Password dimenticata</h1>
        {message ? (
          <p role="status">{message}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Invio in corso…" : "Invia istruzioni"}
            </button>
          </form>
        )}
        <p>
          <Link to="/login">Torna al login</Link>
        </p>
      </div>
    </main>
  );
}

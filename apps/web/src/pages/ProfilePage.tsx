import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { confirmPasswordChange, requestPasswordChange } from "../api/auth";
import { getMeasurements, updateMeasurements } from "../api/profile";
import { ApiRequestError } from "../api/client";

type ProfileSection = "account" | "measurements";

/** Nullable o maggiore di zero: 0 (o un negativo, impedito gia' da min={0}
 *  sull'input) non e' una misura valida, va trattato come "non impostata"
 *  invece di essere inviato al server e farsi respingere con un errore. */
function parseMeasurement(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return parsed > 0 ? parsed : null;
}

export function ProfilePage() {
  const { user, token } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>("account");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [armCm, setArmCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [legCm, setLegCm] = useState("");
  const [measurementsLoaded, setMeasurementsLoaded] = useState(false);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [measurementsMessage, setMeasurementsMessage] = useState<string | null>(null);
  const [isSavingMeasurements, setIsSavingMeasurements] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    getMeasurements(token)
      .then((data) => {
        setHeightCm(data.heightCm !== null ? String(data.heightCm) : "");
        setWeightKg(data.weightKg !== null ? String(data.weightKg) : "");
        setChestCm(data.chestCm !== null ? String(data.chestCm) : "");
        setArmCm(data.armCm !== null ? String(data.armCm) : "");
        setWaistCm(data.waistCm !== null ? String(data.waistCm) : "");
        setLegCm(data.legCm !== null ? String(data.legCm) : "");
        setMeasurementsLoaded(true);
      })
      .catch((err: unknown) => {
        setMeasurementsError(
          err instanceof ApiRequestError ? err.message : "Impossibile caricare le misure."
        );
      });
  }, [token]);

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

  async function handleSaveMeasurements(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMeasurementsError(null);
    setMeasurementsMessage(null);
    if (!token) {
      return;
    }

    setIsSavingMeasurements(true);
    try {
      const result = await updateMeasurements(token, {
        heightCm: parseMeasurement(heightCm),
        weightKg: parseMeasurement(weightKg),
        chestCm: parseMeasurement(chestCm),
        armCm: parseMeasurement(armCm),
        waistCm: parseMeasurement(waistCm),
        legCm: parseMeasurement(legCm),
      });
      setHeightCm(result.heightCm !== null ? String(result.heightCm) : "");
      setWeightKg(result.weightKg !== null ? String(result.weightKg) : "");
      setChestCm(result.chestCm !== null ? String(result.chestCm) : "");
      setArmCm(result.armCm !== null ? String(result.armCm) : "");
      setWaistCm(result.waistCm !== null ? String(result.waistCm) : "");
      setLegCm(result.legCm !== null ? String(result.legCm) : "");
      setMeasurementsMessage("Misure salvate.");
    } catch (err) {
      setMeasurementsError(
        err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova."
      );
    } finally {
      setIsSavingMeasurements(false);
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

      <div className="toolbar">
        <button
          type="button"
          className={activeSection === "account" ? undefined : "secondary"}
          onClick={() => setActiveSection("account")}
        >
          Account
        </button>
        <button
          type="button"
          className={activeSection === "measurements" ? undefined : "secondary"}
          onClick={() => setActiveSection("measurements")}
        >
          Misure
        </button>
      </div>

      {activeSection === "account" && (
        <>
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
        </>
      )}

      {activeSection === "measurements" && (
        <section className="card">
          <h2>Misure atleta</h2>
          {!measurementsLoaded && !measurementsError && <p>Caricamento…</p>}
          {measurementsLoaded && (
            <form onSubmit={handleSaveMeasurements}>
              <label>
                Altezza (cm)
                <input
                  type="number"
                  min={0}
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                />
              </label>
              <label>
                Peso (kg)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                />
              </label>
              <label>
                Petto (cm)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={chestCm}
                  onChange={(event) => setChestCm(event.target.value)}
                />
              </label>
              <label>
                Braccia (cm)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={armCm}
                  onChange={(event) => setArmCm(event.target.value)}
                />
              </label>
              <label>
                Vita (cm)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={waistCm}
                  onChange={(event) => setWaistCm(event.target.value)}
                />
              </label>
              <label>
                Gamba (cm)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={legCm}
                  onChange={(event) => setLegCm(event.target.value)}
                />
              </label>
              {measurementsError && (
                <p role="alert" className="form-error">
                  {measurementsError}
                </p>
              )}
              {measurementsMessage && <p role="status">{measurementsMessage}</p>}
              <button type="submit" disabled={isSavingMeasurements}>
                {isSavingMeasurements ? "Salvataggio…" : "Salva misure"}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}

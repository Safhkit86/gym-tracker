import { useEffect, useState, type FormEvent } from "react";
import type { AccountPreferences, ProgressionPreferences } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { confirmPasswordChange, requestPasswordChange } from "../api/auth";
import {
  getAccountPreferences,
  getMeasurements,
  getProgressionPreferences,
  updateAccountPreferences,
  updateMeasurements,
  updateProgressionPreferences,
} from "../api/profile";
import { ApiRequestError } from "../api/client";

type ProfileSection = "account" | "measurements" | "preferences";

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [measuredOn, setMeasuredOn] = useState(today());
  const [measurementsLoaded, setMeasurementsLoaded] = useState(false);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [measurementsMessage, setMeasurementsMessage] = useState<string | null>(null);
  const [isSavingMeasurements, setIsSavingMeasurements] = useState(false);

  const [requiredConsecutiveSessions, setRequiredConsecutiveSessions] = useState("2");
  const [groupingScope, setGroupingScope] =
    useState<ProgressionPreferences["groupingScope"]>("workout");
  const [prefillScope, setPrefillScope] = useState<AccountPreferences["prefillScope"]>("workout");
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(false);
  const [historicizeMeasurements, setHistoricizeMeasurements] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([getProgressionPreferences(token), getAccountPreferences(token)])
      .then(([progression, account]) => {
        setRequiredConsecutiveSessions(String(progression.requiredConsecutiveSessions));
        setGroupingScope(progression.groupingScope);
        setPrefillScope(account.prefillScope);
        setTimerSoundEnabled(account.timerSoundEnabled);
        setHistoricizeMeasurements(account.historicizeMeasurements);
        setPreferencesLoaded(true);
      })
      .catch((err: unknown) => {
        setPreferencesError(
          err instanceof ApiRequestError ? err.message : "Impossibile caricare le preferenze."
        );
      });
  }, [token]);

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
      const [result] = await Promise.all([
        updateMeasurements(token, {
          heightCm: parseMeasurement(heightCm),
          weightKg: parseMeasurement(weightKg),
          chestCm: parseMeasurement(chestCm),
          armCm: parseMeasurement(armCm),
          waistCm: parseMeasurement(waistCm),
          legCm: parseMeasurement(legCm),
          measuredOn: historicizeMeasurements ? measuredOn : undefined,
        }),
        updateAccountPreferences(token, {
          prefillScope,
          timerSoundEnabled,
          historicizeMeasurements,
        }),
      ]);
      setHeightCm(result.heightCm !== null ? String(result.heightCm) : "");
      setWeightKg(result.weightKg !== null ? String(result.weightKg) : "");
      setChestCm(result.chestCm !== null ? String(result.chestCm) : "");
      setArmCm(result.armCm !== null ? String(result.armCm) : "");
      setWaistCm(result.waistCm !== null ? String(result.waistCm) : "");
      setLegCm(result.legCm !== null ? String(result.legCm) : "");
      setMeasurementsMessage(
        historicizeMeasurements
          ? `Misure salvate per il ${measuredOn.split("-").reverse().join("/")}.`
          : "Misure salvate."
      );
    } catch (err) {
      setMeasurementsError(
        err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova."
      );
    } finally {
      setIsSavingMeasurements(false);
    }
  }

  async function handleSavePreferences(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPreferencesError(null);
    setPreferencesMessage(null);
    if (!token) {
      return;
    }

    setIsSavingPreferences(true);
    try {
      const [progressionResult, accountResult] = await Promise.all([
        updateProgressionPreferences(token, {
          requiredConsecutiveSessions: Number(requiredConsecutiveSessions),
          groupingScope,
        }),
        updateAccountPreferences(token, {
          prefillScope,
          timerSoundEnabled,
          historicizeMeasurements,
        }),
      ]);
      setRequiredConsecutiveSessions(String(progressionResult.requiredConsecutiveSessions));
      setGroupingScope(progressionResult.groupingScope);
      setPrefillScope(accountResult.prefillScope);
      setTimerSoundEnabled(accountResult.timerSoundEnabled);
      setHistoricizeMeasurements(accountResult.historicizeMeasurements);
      setPreferencesMessage("Preferenze salvate.");
    } catch (err) {
      setPreferencesError(
        err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova."
      );
    } finally {
      setIsSavingPreferences(false);
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
        <button
          type="button"
          className={activeSection === "preferences" ? undefined : "secondary"}
          onClick={() => setActiveSection("preferences")}
        >
          Preferenze
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
          {measurementsLoaded && preferencesLoaded && (
            <form onSubmit={handleSaveMeasurements}>
              <div className="history-toggle-row">
                <span className="toggle-switch">
                  <input
                    id="historicize-measurements"
                    type="checkbox"
                    checked={historicizeMeasurements}
                    onChange={(event) => setHistoricizeMeasurements(event.target.checked)}
                  />
                  <span className="toggle-switch__track" aria-hidden="true" />
                </span>
                <label htmlFor="historicize-measurements" className="history-toggle-row__text">
                  <strong>Storicizza le misure</strong>
                  <span>
                    Tieni traccia di peso, petto, braccia, vita e gamba nel tempo. Puoi scegliere
                    per quale data registrarle qui sotto.
                  </span>
                </label>
              </div>

              <div className={`date-field-wrap${historicizeMeasurements ? " is-visible" : ""}`}>
                <label>
                  Data di questa misurazione
                  <input
                    type="date"
                    value={measuredOn}
                    max={today()}
                    onChange={(event) => setMeasuredOn(event.target.value)}
                  />
                  <span className="date-field-hint">
                    Lascia oggi per registrare la misurazione di oggi, oppure scegli una data
                    passata per aggiungerla allo storico. Se scegli una data già presente nello
                    storico, la voce esistente verrà aggiornata.
                  </span>
                </label>
              </div>

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

      {activeSection === "preferences" && (
        <section className="card">
          <h2>Preferenze</h2>
          {!preferencesLoaded && !preferencesError && <p>Caricamento…</p>}
          {preferencesLoaded && (
            <form onSubmit={handleSavePreferences}>
              <div className="pref-rows">
                <div className="pref-row">
                  <label htmlFor="pref-required-sessions" className="pref-row__label">
                    Suggerisci progressione quando raggiungi il massimo delle ripetizioni in tutti i
                    set per questo numero di sessioni consecutive
                  </label>
                  <div className="pref-row__control">
                    <input
                      id="pref-required-sessions"
                      type="number"
                      min={1}
                      max={10}
                      value={requiredConsecutiveSessions}
                      onChange={(event) => setRequiredConsecutiveSessions(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="pref-row">
                  <label htmlFor="pref-grouping-scope" className="pref-row__label">
                    Suggerisci progressione considerando
                  </label>
                  <div className="pref-row__control">
                    <select
                      id="pref-grouping-scope"
                      value={groupingScope}
                      onChange={(event) =>
                        setGroupingScope(
                          event.target.value as ProgressionPreferences["groupingScope"]
                        )
                      }
                    >
                      <option value="workout">Scheda + esercizio</option>
                      <option value="exercise">Esercizio</option>
                    </select>
                  </div>
                </div>
                <div className="pref-row">
                  <label htmlFor="pref-prefill-scope" className="pref-row__label">
                    Riporta ultime ripetizioni effettive di default da
                  </label>
                  <div className="pref-row__control">
                    <select
                      id="pref-prefill-scope"
                      value={prefillScope}
                      onChange={(event) =>
                        setPrefillScope(event.target.value as AccountPreferences["prefillScope"])
                      }
                    >
                      <option value="workout">Scheda + esercizio</option>
                      <option value="exercise">Esercizio</option>
                    </select>
                  </div>
                </div>
                <div className="pref-row">
                  <label htmlFor="pref-timer-sound" className="pref-row__label">
                    Suono sveglia a fine recupero (timer in Registra sessione)
                  </label>
                  <div className="pref-row__control">
                    <span className="toggle-switch">
                      <input
                        id="pref-timer-sound"
                        type="checkbox"
                        checked={timerSoundEnabled}
                        onChange={(event) => setTimerSoundEnabled(event.target.checked)}
                      />
                      <span className="toggle-switch__track" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="pref-form__actions">
                {preferencesError && (
                  <p role="alert" className="form-error">
                    {preferencesError}
                  </p>
                )}
                {preferencesMessage && <p role="status">{preferencesMessage}</p>}
                <button type="submit" disabled={isSavingPreferences}>
                  {isSavingPreferences ? "Salvataggio…" : "Salva preferenze"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}

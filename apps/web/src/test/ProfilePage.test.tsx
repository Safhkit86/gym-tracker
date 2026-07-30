import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { ProfilePage } from "../pages/ProfilePage";

const FAKE_USER = {
  id: "u1",
  email: "test@example.com",
  createdAt: new Date("2026-01-15").toISOString(),
};

const EMPTY_MEASUREMENTS = {
  heightCm: null,
  weightKg: null,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
};

function measurementsHandler(body: unknown = EMPTY_MEASUREMENTS) {
  return { match: (u: string, m: string) => u.endsWith("/me/measurements") && m === "GET", body };
}

const DEFAULT_PROGRESSION_PREFERENCES = {
  requiredConsecutiveSessions: 2,
  groupingScope: "workout",
};

const DEFAULT_ACCOUNT_PREFERENCES = {
  prefillScope: "workout",
  timerSoundEnabled: false,
  historicizeMeasurements: true,
};

function preferencesHandler(body: unknown = DEFAULT_PROGRESSION_PREFERENCES) {
  return { match: (u: string, m: string) => u.endsWith("/me/preferences") && m === "GET", body };
}

function accountPreferencesHandler(body: unknown = DEFAULT_ACCOUNT_PREFERENCES) {
  return {
    match: (u: string, m: string) => u.endsWith("/me/account-preferences") && m === "GET",
    body,
  };
}

/** Echo semplice per il PUT /me/account-preferences pubblicato insieme al
 *  salvataggio delle misure (vedi ProfilePage.handleSaveMeasurements): i test
 *  sulle misure non verificano questo body, serve solo a far risolvere il
 *  Promise.all senza una richiesta non gestita dal mock. */
function accountPreferencesPutHandler(body: unknown = DEFAULT_ACCOUNT_PREFERENCES) {
  return {
    match: (u: string, m: string) => u.endsWith("/me/account-preferences") && m === "PUT",
    body,
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra email e data di iscrizione", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    expect(await screen.findByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/membro dal/i)).toBeInTheDocument();
  });

  it("invia password attuale+nuova, poi conferma con l'OTP", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
      {
        match: (u, m) => u.endsWith("/me/password/change-request") && m === "POST",
        body: { message: "Codice di conferma inviato via email." },
      },
      {
        match: (u, m) => u.endsWith("/me/password/change-confirm") && m === "POST",
        body: { message: "Password aggiornata correttamente." },
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByLabelText("Password attuale");
    fireEvent.change(screen.getByLabelText("Password attuale"), {
      target: { value: "vecchiapassword" },
    });
    fireEvent.change(screen.getByLabelText("Nuova password"), {
      target: { value: "nuovapassword" },
    });
    fireEvent.change(screen.getByLabelText("Conferma nuova password"), {
      target: { value: "nuovapassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /invia codice di conferma/i }));

    expect(await screen.findByLabelText(/codice ricevuto via email/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/codice ricevuto via email/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /conferma cambio password/i }));

    expect(await screen.findByText("Password aggiornata correttamente.")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).endsWith("/me/password/change-confirm"))
      ).toBe(true);
    });
  });

  it("mostra un errore se la password attuale e' sbagliata, senza passare all'OTP", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
      {
        match: (u, m) => u.endsWith("/me/password/change-request") && m === "POST",
        status: 400,
        body: { code: "INVALID_CURRENT_PASSWORD", message: "Password attuale non corretta." },
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByLabelText("Password attuale");
    fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: "sbagliata" } });
    fireEvent.change(screen.getByLabelText("Nuova password"), {
      target: { value: "nuovapassword" },
    });
    fireEvent.change(screen.getByLabelText("Conferma nuova password"), {
      target: { value: "nuovapassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /invia codice di conferma/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Password attuale non corretta.");
    expect(screen.queryByLabelText(/codice ricevuto via email/i)).not.toBeInTheDocument();
  });

  it("mostra la sezione Account di default, con Misure raggiungibile da un pulsante", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    expect(screen.queryByLabelText(/altezza/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Misure" }));

    expect(await screen.findByLabelText(/altezza/i)).toBeInTheDocument();
    expect(screen.queryByText(/test@example.com/)).not.toBeInTheDocument();
  });

  it("precompila le misure gia' salvate e permette di aggiornarle", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler({
        heightCm: 180,
        weightKg: 78.5,
        chestCm: 100,
        armCm: 35,
        waistCm: 85,
        legCm: 55,
      }),
      preferencesHandler(),
      // Storicizzazione disattivata: questo test riguarda il precompilamento
      // e l'aggiornamento dei valori, non il messaggio specifico per data.
      accountPreferencesHandler({ ...DEFAULT_ACCOUNT_PREFERENCES, historicizeMeasurements: false }),
      accountPreferencesPutHandler(),
      {
        match: (u, m) => u.endsWith("/me/measurements") && m === "PUT",
        body: {
          heightCm: 180,
          weightKg: 76,
          chestCm: 100,
          armCm: 35,
          waistCm: 85,
          legCm: 55,
        },
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Misure" }));

    // Match esatto (non /peso/i): la spiegazione del toggle "Storicizza le
    // misure" contiene anch'essa la parola "peso", che altrimenti la
    // renderebbe ambigua con l'etichetta del campo.
    const weightInput = (await screen.findByLabelText("Peso (kg)")) as HTMLInputElement;
    expect(weightInput.value).toBe("78.5");
    expect((screen.getByLabelText(/altezza/i) as HTMLInputElement).value).toBe("180");

    fireEvent.change(weightInput, { target: { value: "76" } });
    fireEvent.click(screen.getByRole("button", { name: /salva misure/i }));

    expect(await screen.findByText("Misure salvate.")).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith("/me/measurements") && init?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse((putCall?.[1]?.body as string) ?? "{}")).toMatchObject({ weightKg: 76 });
  });

  it("nessun campo delle misure e' obbligatorio", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      // Storicizzazione disattivata: il messaggio di conferma resta generico
      // ("Misure salvate."), non specifico per data — questi test non
      // riguardano il toggle, solo la validazione dei campi.
      accountPreferencesHandler({ ...DEFAULT_ACCOUNT_PREFERENCES, historicizeMeasurements: false }),
      accountPreferencesPutHandler(),
      {
        match: (u, m) => u.endsWith("/me/measurements") && m === "PUT",
        body: EMPTY_MEASUREMENTS,
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Misure" }));

    await screen.findByLabelText(/altezza/i);
    fireEvent.click(screen.getByRole("button", { name: /salva misure/i }));

    expect(await screen.findByText("Misure salvate.")).toBeInTheDocument();
  });

  it("un valore 0 viene trattato come non impostato (null), non inviato come 0", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      // Storicizzazione disattivata: il messaggio di conferma resta generico
      // ("Misure salvate."), non specifico per data — questi test non
      // riguardano il toggle, solo la validazione dei campi.
      accountPreferencesHandler({ ...DEFAULT_ACCOUNT_PREFERENCES, historicizeMeasurements: false }),
      accountPreferencesPutHandler(),
      {
        match: (u, m) => u.endsWith("/me/measurements") && m === "PUT",
        body: EMPTY_MEASUREMENTS,
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Misure" }));

    const heightInput = await screen.findByLabelText(/altezza/i);
    fireEvent.change(heightInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /salva misure/i }));

    expect(await screen.findByText("Misure salvate.")).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith("/me/measurements") && init?.method === "PUT"
    );
    expect(JSON.parse((putCall?.[1]?.body as string) ?? "{}")).toMatchObject({ heightCm: null });
  });

  it("mostra le preferenze di default (2, scheda+esercizio) nel tab Preferenze", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Preferenze" }));

    const sessionsInput = (await screen.findByLabelText(
      /suggerisci progressione quando raggiungi il massimo/i
    )) as HTMLInputElement;
    expect(sessionsInput.value).toBe("2");
    const scopeSelect = screen.getByLabelText(
      /suggerisci progressione considerando/i
    ) as HTMLSelectElement;
    expect(scopeSelect.value).toBe("workout");
    const prefillSelect = screen.getByLabelText(
      /riporta ultime ripetizioni effettive di default da/i
    ) as HTMLSelectElement;
    expect(prefillSelect.value).toBe("workout");
    const timerSoundCheckbox = screen.getByLabelText(/suono sveglia/i) as HTMLInputElement;
    expect(timerSoundCheckbox.checked).toBe(false);
  });

  it("salva le preferenze aggiornate (X, raggruppamento e scope di precompilazione)", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
      {
        match: (u, m) => u.endsWith("/me/preferences") && m === "PUT",
        body: { requiredConsecutiveSessions: 3, groupingScope: "exercise" },
      },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "PUT",
        body: { prefillScope: "exercise", timerSoundEnabled: false },
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Preferenze" }));

    const sessionsInput = await screen.findByLabelText(
      /suggerisci progressione quando raggiungi il massimo/i
    );
    fireEvent.change(sessionsInput, { target: { value: "3" } });
    const scopeSelect = screen.getByLabelText(/suggerisci progressione considerando/i);
    fireEvent.change(scopeSelect, { target: { value: "exercise" } });
    const prefillSelect = screen.getByLabelText(
      /riporta ultime ripetizioni effettive di default da/i
    );
    fireEvent.change(prefillSelect, { target: { value: "exercise" } });
    fireEvent.click(screen.getByRole("button", { name: /salva preferenze/i }));

    expect(await screen.findByText("Preferenze salvate.")).toBeInTheDocument();
    const progressionPutCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith("/me/preferences") && init?.method === "PUT"
    );
    expect(progressionPutCall).toBeDefined();
    expect(JSON.parse((progressionPutCall?.[1]?.body as string) ?? "{}")).toEqual({
      requiredConsecutiveSessions: 3,
      groupingScope: "exercise",
    });
    const accountPutCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith("/me/account-preferences") && init?.method === "PUT"
    );
    expect(accountPutCall).toBeDefined();
    expect(JSON.parse((accountPutCall?.[1]?.body as string) ?? "{}")).toEqual({
      prefillScope: "exercise",
      timerSoundEnabled: false,
      historicizeMeasurements: true,
    });
  });

  it("salva la preferenza suono sveglia quando il checkbox viene attivato", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
      preferencesHandler(),
      accountPreferencesHandler(),
      {
        match: (u, m) => u.endsWith("/me/preferences") && m === "PUT",
        body: DEFAULT_PROGRESSION_PREFERENCES,
      },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "PUT",
        body: { ...DEFAULT_ACCOUNT_PREFERENCES, timerSoundEnabled: true },
      },
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    await screen.findByText(/test@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Preferenze" }));

    const timerSoundCheckbox = await screen.findByLabelText(/suono sveglia/i);
    fireEvent.click(timerSoundCheckbox);
    fireEvent.click(screen.getByRole("button", { name: /salva preferenze/i }));

    expect(await screen.findByText("Preferenze salvate.")).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith("/me/account-preferences") && init?.method === "PUT"
    );
    expect(JSON.parse((putCall?.[1]?.body as string) ?? "{}")).toMatchObject({
      timerSoundEnabled: true,
    });
  });
});

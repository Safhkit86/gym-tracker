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
    ]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    expect(await screen.findByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/membro dal/i)).toBeInTheDocument();
  });

  it("invia password attuale+nuova, poi conferma con l'OTP", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      measurementsHandler(),
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

    const weightInput = (await screen.findByLabelText(/peso/i)) as HTMLInputElement;
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
});

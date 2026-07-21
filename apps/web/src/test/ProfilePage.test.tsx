import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { ProfilePage } from "../pages/ProfilePage";

const FAKE_USER = {
  id: "u1",
  email: "test@example.com",
  createdAt: new Date("2026-01-15").toISOString(),
};

describe("ProfilePage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra email e data di iscrizione", async () => {
    mockFetchResponses([{ match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER }]);

    renderWithProviders(<ProfilePage />, ["/profile"]);

    expect(await screen.findByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/membro dal/i)).toBeInTheDocument();
  });

  it("invia password attuale+nuova, poi conferma con l'OTP", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
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
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "./helpers";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";

function renderResetPage(initialEntry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/login" element={<p>Pagina di login</p>} />
    </Routes>,
    [initialEntry]
  );
}

describe("ResetPasswordPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra un errore se manca il token nella query string", async () => {
    renderResetPage("/reset-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(/link di reset non valido/i);
  });

  it("mostra un errore se le due password non coincidono", async () => {
    renderResetPage("/reset-password?token=abc123");

    fireEvent.change(screen.getByLabelText("Nuova password"), {
      target: { value: "passwordnuova" },
    });
    fireEvent.change(screen.getByLabelText("Conferma nuova password"), {
      target: { value: "passworddiversa" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reimposta password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Le due password non coincidono.");
  });

  it("invia il token e la nuova password, poi reindirizza al login", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Password reimpostata correttamente." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderResetPage("/reset-password?token=abc123");

    fireEvent.change(screen.getByLabelText("Nuova password"), {
      target: { value: "passwordnuova" },
    });
    fireEvent.change(screen.getByLabelText("Conferma nuova password"), {
      target: { value: "passwordnuova" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reimposta password/i }));

    expect(await screen.findByText("Pagina di login")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body).toEqual({ token: "abc123", newPassword: "passwordnuova" });
  });
});

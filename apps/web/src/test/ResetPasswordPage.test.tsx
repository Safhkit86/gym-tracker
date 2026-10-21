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
    vi.restoreAllMocks();
  });

  it("mostra un errore se manca il token nella query string", async () => {
    renderResetPage("/reset-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(/link di reset non valido/i);
  });

  it("rimuove il token dall'URL/cronologia del browser non appena letto", async () => {
    // Il token non deve restare visibile nella barra degli indirizzi (vedi
    // commento nel componente: screenshot, "copia link", cronologia
    // condivisa su un device pubblico lo esporrebbero di nuovo anche se è
    // già a uso singolo lato server).
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderResetPage("/reset-password?token=abc123");
    await screen.findByRole("button", { name: /reimposta password/i });

    expect(replaceStateSpy).toHaveBeenCalled();
  });

  it("non tocca la cronologia quando non c'e' alcun token da rimuovere", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderResetPage("/reset-password");
    await screen.findByRole("alert");

    expect(replaceStateSpy).not.toHaveBeenCalled();
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

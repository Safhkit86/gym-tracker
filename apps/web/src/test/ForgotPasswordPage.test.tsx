import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra il messaggio generico ricevuto dal backend dopo l'invio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          message:
            "Se l'account esiste, riceverai un'email con le istruzioni per reimpostare la password.",
        }),
      })
    );

    renderWithProviders(<ForgotPasswordPage />, ["/forgot-password"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /invia istruzioni/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se l'account esiste, riceverai un'email con le istruzioni per reimpostare la password."
    );
  });

  it("mostra un errore se la richiesta fallisce lato server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          code: "RATE_LIMITED",
          message: "Troppe richieste, riprova più tardi.",
        }),
      })
    );

    renderWithProviders(<ForgotPasswordPage />, ["/forgot-password"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /invia istruzioni/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Troppe richieste, riprova più tardi."
    );
  });
});

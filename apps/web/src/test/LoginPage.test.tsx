import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { LoginPage } from "../pages/LoginPage";

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra un errore se le credenziali sono errate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          code: "INVALID_CREDENTIALS",
          message: "Email o password non validi.",
        }),
      })
    );

    renderWithProviders(<LoginPage />, ["/login"]);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "sbagliata1" } });
    fireEvent.click(screen.getByRole("button", { name: /accedi/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o password non validi.");
  });

  it("mostra il link 'Password dimenticata?' verso /forgot-password", async () => {
    renderWithProviders(<LoginPage />, ["/login"]);

    const link = screen.getByRole("link", { name: /password dimenticata/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});

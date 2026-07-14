import type { ReactElement } from "react";
import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";

/** Renderizza un componente dentro Router + AuthProvider, come nell'app reale. */
export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

// Deve combaciare con TOKEN_STORAGE_KEY in auth/AuthProvider.tsx.
const TOKEN_STORAGE_KEY = "gym-tracker.token";
export const TEST_TOKEN = "test-token";

/** Simula un utente gia' autenticato prima del render (AuthProvider lo legge da localStorage). */
export function seedAuthToken(): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, TEST_TOKEN);
}

interface FetchHandler {
  match: (url: string, method: string) => boolean;
  status?: number;
  body?: unknown;
}

/**
 * Sostituisce `fetch` globale con un router minimale basato su handler
 * dichiarativi, cosi' i test possono simulare piu' endpoint (es. /me +
 * /workouts) nella stessa pagina senza un vero server. Ritorna il mock per
 * asserzioni su `.mock.calls` (es. verificare il body di una POST).
 */
export function mockFetchResponses(handlers: FetchHandler[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const handler = handlers.find((h) => h.match(url, method));
    if (!handler) {
      throw new Error(`Nessun handler mockato per ${method} ${url}`);
    }
    const status = handler.status ?? 200;
    return {
      ok: status < 300,
      status,
      headers: new Headers(
        handler.body !== undefined ? { "content-type": "application/json" } : {}
      ),
      json: async () => handler.body,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

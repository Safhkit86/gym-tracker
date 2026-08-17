import type { ReactElement } from "react";
import { Dimensions } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../auth/AuthProvider";
import { NotificationsProvider } from "../notifications/NotificationsProvider";
import "../i18n";

/** Preset di dimensioni per i test che devono verificare il layout
 *  responsive (griglie, cap+centra, sidebar). "phone" è il default già
 *  impostato una volta da jest.setup.ts — richiamarlo qui serve solo per
 *  ripristinarlo esplicitamente a fine test se un test precedente ha
 *  cambiato dimensioni. Stessi dp del AVD Pixel_Tablet usato per la
 *  verifica manuale (2560x1600 @ 320dpi → 1280x800 landscape, 800x1280
 *  portrait), così i test e la verifica sull'emulatore esercitano
 *  esattamente lo stesso breakpoint. */
const DEVICE_DIMENSIONS_DP = {
  phone: { width: 390, height: 844 },
  tabletPortrait: { width: 800, height: 1280 },
  tabletLandscape: { width: 1280, height: 800 },
} as const;

export function setDeviceDimensions(preset: keyof typeof DEVICE_DIMENSIONS_DP): void {
  const { width, height } = DEVICE_DIMENSIONS_DP[preset];
  const size = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: size, screen: size });
}

/** Renderizza un componente dentro SafeAreaProvider + AuthProvider +
 *  NotificationsProvider, stessa gerarchia di App.tsx/RootNavigator
 *  nell'app reale (il badge non letto e' disponibile a qualunque
 *  schermata tramite useUnreadCount, useSafeAreaInsets funziona su
 *  qualunque schermata che lo consumi per il padding degli inset), e
 *  aspetta che l'idratazione async del token (SecureStore, vedi
 *  AuthProvider) si stabilizzi prima di restituire il controllo al test —
 *  altrimenti React si lamenta di aggiornamenti di stato fuori da act()
 *  quando quella promise si risolve dopo la fine del test. Equivalente
 *  mobile di apps/web/src/test/helpers.tsx (li' non serve: localStorage e'
 *  sincrona). */
// Senza initialMetrics, RNCSafeAreaProvider in ambiente Jest non renderizza
// affatto i figli: aspetta un onLayout nativo che non arriva mai nel
// renderer di test (nessuna misurazione reale) — ogni query su un elemento
// dentro finiva per fallire con "Unable to find an element" anche quando
// l'elemento c'era, perche' l'albero sotto SafeAreaProvider restava vuoto.
const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function withProviders(ui: ReactElement): ReactElement {
  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <AuthProvider>
        <NotificationsProvider>{ui}</NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export async function renderWithProviders(ui: ReactElement) {
  const result = render(withProviders(ui));
  await waitFor(() => {});
  // rerender() di @testing-library/react-native sostituisce l'intero
  // albero renderizzato, non solo il punto dove stava `ui`: senza
  // riavvolgere anche qui negli stessi provider, un test che simula una
  // seconda navigazione (nuovi route.params sullo stesso componente già
  // montato, es. StatisticsScreen) perderebbe AuthProvider/
  // NotificationsProvider al richiamo di rerender(), facendo fallire
  // useAuth() con "deve essere usato dentro <AuthProvider>".
  return {
    ...result,
    rerender: (nextUi: ReactElement) => result.rerender(withProviders(nextUi)),
  };
}

interface FetchHandler {
  match: (url: string, method: string) => boolean;
  status?: number;
  body?: unknown;
}

/** Stesso pattern di apps/web/src/test/helpers.tsx: router minimale su
 *  `fetch` basato su handler dichiarativi. */
export function mockFetchResponses(handlers: FetchHandler[]) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

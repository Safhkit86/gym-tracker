import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { ResetPasswordScreen } from "../screens/auth/ResetPasswordScreen";
import type { AuthStackParamList } from "../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

function mockNavigation(): Props["navigation"] {
  return { navigate: jest.fn(), reset: jest.fn() } as unknown as Props["navigation"];
}

function mockRoute(token?: string): Props["route"] {
  return { params: token ? { token } : undefined } as Props["route"];
}

describe("ResetPasswordScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra un errore invece del form se manca il token", async () => {
    const screen = await renderWithProviders(
      <ResetPasswordScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link di reset non valido: manca il token."
    );
    expect(screen.queryByLabelText("Nuova password")).toBeNull();
  });

  it("naviga a ForgotPassword da 'Richiedi un nuovo link' quando manca il token", async () => {
    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <ResetPasswordScreen navigation={navigation} route={mockRoute()} />
    );

    fireEvent.press(screen.getByRole("button", { name: "Richiedi un nuovo link" }));

    expect(navigation.navigate).toHaveBeenCalledWith("ForgotPassword");
  });

  it("mostra un errore se le due password non coincidono", async () => {
    const screen = await renderWithProviders(
      <ResetPasswordScreen navigation={mockNavigation()} route={mockRoute("tok123")} />
    );

    fireEvent.changeText(screen.getByLabelText("Nuova password"), "nuovaPassword1");
    fireEvent.changeText(screen.getByLabelText("Conferma nuova password"), "diversa2");
    fireEvent.press(screen.getByRole("button", { name: "Reimposta password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Le due password non coincidono."
    );
  });

  it("invia il reset e torna a Login con il messaggio di successo", async () => {
    const fetchMock = mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/reset-password") && m === "POST",
        body: { message: "Password reimpostata correttamente." },
      },
    ]);
    const navigation = mockNavigation();

    const screen = await renderWithProviders(
      <ResetPasswordScreen navigation={navigation} route={mockRoute("tok123")} />
    );

    fireEvent.changeText(screen.getByLabelText("Nuova password"), "nuovaPassword1");
    fireEvent.changeText(screen.getByLabelText("Conferma nuova password"), "nuovaPassword1");
    fireEvent.press(screen.getByRole("button", { name: "Reimposta password" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/auth/reset-password"),
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(navigation.reset).toHaveBeenCalledWith(
        expect.objectContaining({
          routes: [
            expect.objectContaining({
              name: "Login",
              params: { message: "Password reimpostata: accedi con la nuova password." },
            }),
          ],
        })
      );
    });
  });

  it("mostra un errore se il token e' scaduto o non valido", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/reset-password") && m === "POST",
        status: 400,
        body: { code: "INVALID_RESET_TOKEN", message: "Link di reset non valido o scaduto." },
      },
    ]);

    const screen = await renderWithProviders(
      <ResetPasswordScreen navigation={mockNavigation()} route={mockRoute("tok123")} />
    );

    fireEvent.changeText(screen.getByLabelText("Nuova password"), "nuovaPassword1");
    fireEvent.changeText(screen.getByLabelText("Conferma nuova password"), "nuovaPassword1");
    fireEvent.press(screen.getByRole("button", { name: "Reimposta password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link di reset non valido o scaduto."
    );
  });
});

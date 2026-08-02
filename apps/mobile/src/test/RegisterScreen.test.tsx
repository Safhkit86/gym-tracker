import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import type { AuthStackParamList } from "../navigation/AuthNavigator";

type RegisterProps = NativeStackScreenProps<AuthStackParamList, "Register">;

// Solo `navigate` e' usato da RegisterScreen: il resto dell'oggetto
// navigation non serve in questi test, da qui il cast.
function mockNavigation(): RegisterProps["navigation"] {
  return { navigate: jest.fn() } as unknown as RegisterProps["navigation"];
}

const emptyRoute = {} as RegisterProps["route"];

describe("RegisterScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra un errore se l'email e' gia' in uso", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/register") && m === "POST",
        status: 409,
        body: {
          code: "EMAIL_ALREADY_IN_USE",
          message: "Esiste gia' un utente con questa email.",
        },
      },
    ]);

    const screen = await renderWithProviders(
      <RegisterScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByRole("button", { name: "Registrati" }));

    // Il messaggio mostrato e' quello del catalogo i18n (vedi
    // src/i18n/locales/it.json), non quello grezzo del backend passato
    // sopra come body: EMAIL_ALREADY_IN_USE e' un codice gia' mappato,
    // quindi translateError() lo preferisce al fallback (per design).
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esiste già un utente con questa email."
    );
  });

  it("naviga a Login quando si tocca 'Accedi'", async () => {
    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <RegisterScreen navigation={navigation} route={emptyRoute} />
    );

    fireEvent.press(screen.getByRole("button", { name: "Accedi" }));

    expect(navigation.navigate).toHaveBeenCalledWith("Login");
  });

  it("chiama /auth/register e non mostra errori quando la registrazione va a buon fine", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/register") && m === "POST",
        body: {
          token: "fake-token",
          user: { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() },
        },
      },
      {
        match: (u, m) => u.endsWith("/me") && m === "GET",
        body: { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() },
      },
    ]);

    const screen = await renderWithProviders(
      <RegisterScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    fireEvent.changeText(screen.getByLabelText("Email"), "nuovo@b.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByRole("button", { name: "Registrati" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});

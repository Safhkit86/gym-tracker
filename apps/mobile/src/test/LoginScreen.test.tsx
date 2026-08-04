import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { LoginScreen } from "../screens/auth/LoginScreen";
import type { AuthStackParamList } from "../navigation/AuthNavigator";

type LoginProps = NativeStackScreenProps<AuthStackParamList, "Login">;

// Solo `navigate` e' usato da LoginScreen: il resto dell'oggetto navigation
// (goBack, dispatch, ecc.) non serve in questi test, da qui il cast.
function mockNavigation(): LoginProps["navigation"] {
  return { navigate: jest.fn() } as unknown as LoginProps["navigation"];
}

const emptyRoute = {} as LoginProps["route"];

describe("LoginScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra un errore se le credenziali sono errate", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/login") && m === "POST",
        status: 401,
        body: { code: "INVALID_CREDENTIALS", message: "Email o password non validi." },
      },
    ]);

    const screen = await renderWithProviders(
      <LoginScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "sbagliata1");
    fireEvent.press(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o password non validi.");
  });

  it("naviga a Register quando si tocca 'Registrati'", async () => {
    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <LoginScreen navigation={navigation} route={emptyRoute} />
    );

    fireEvent.press(screen.getByRole("button", { name: "Registrati" }));

    expect(navigation.navigate).toHaveBeenCalledWith("Register");
  });

  it("naviga a ForgotPassword quando si tocca 'Password dimenticata?'", async () => {
    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <LoginScreen navigation={navigation} route={emptyRoute} />
    );

    fireEvent.press(screen.getByRole("button", { name: "Password dimenticata?" }));

    expect(navigation.navigate).toHaveBeenCalledWith("ForgotPassword");
  });

  it("mostra il messaggio ricevuto da ResetPasswordScreen dopo un reset riuscito", async () => {
    const routeWithMessage = {
      params: { message: "Password reimpostata: accedi con la nuova password." },
    } as LoginProps["route"];

    const screen = await renderWithProviders(
      <LoginScreen navigation={mockNavigation()} route={routeWithMessage} />
    );

    expect(
      await screen.findByText("Password reimpostata: accedi con la nuova password.")
    ).toBeTruthy();
  });

  it("chiama /auth/login e non mostra errori quando le credenziali sono corrette", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/login") && m === "POST",
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
      <LoginScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "correcthorse");
    fireEvent.press(screen.getByRole("button", { name: "Accedi" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});

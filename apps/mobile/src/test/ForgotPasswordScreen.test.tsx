import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import type { AuthStackParamList } from "../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

function mockNavigation(): Props["navigation"] {
  return { navigate: jest.fn() } as unknown as Props["navigation"];
}

const emptyRoute = {} as Props["route"];

describe("ForgotPasswordScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("invia la richiesta e mostra il messaggio generico al posto del form", async () => {
    const fetchMock = mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/forgot-password") && m === "POST",
        body: {
          message:
            "Se l'account esiste, riceverai un'email con le istruzioni per reimpostare la password.",
        },
      },
    ]);

    const screen = await renderWithProviders(
      <ForgotPasswordScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    fireEvent.press(screen.getByRole("button", { name: "Invia istruzioni" }));

    expect(
      await screen.findByText(
        "Se l'account esiste, riceverai un'email con le istruzioni per reimpostare la password."
      )
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/forgot-password"),
      expect.objectContaining({ method: "POST" })
    );
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("mostra un errore se la richiesta fallisce", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/auth/forgot-password") && m === "POST",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(
      <ForgotPasswordScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    fireEvent.press(screen.getByRole("button", { name: "Invia istruzioni" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });

  it("naviga a Login quando si tocca 'Torna al login'", async () => {
    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <ForgotPasswordScreen navigation={navigation} route={emptyRoute} />
    );

    fireEvent.press(screen.getByRole("button", { name: "Torna al login" }));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("Login");
    });
  });
});

import { Alert } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { useRootedDeviceWarning } from "../hooks/useRootedDeviceWarning";
import "../i18n";

// jest-expo mocka automaticamente i moduli expo-* non altrimenti
// configurati (vedi jest.setup.ts), ma per expo-device l'automock ritorna
// semplicemente undefined da isRootedExperimentalAsync — utile per non far
// esplodere altri test che montano App.tsx, ma insufficiente per
// verificare qui sia il ramo "rootato" sia quello "non rootato": serve un
// mock esplicito per-test, come per expo-secure-store/expo-audio.
jest.mock("expo-device", () => ({
  isRootedExperimentalAsync: jest.fn(),
}));

function TestHarness() {
  useRootedDeviceWarning();
  return null;
}

describe("useRootedDeviceWarning", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra un avviso non bloccante se il device risulta rootato", async () => {
    const Device = jest.requireMock("expo-device") as {
      isRootedExperimentalAsync: jest.Mock;
    };
    Device.isRootedExperimentalAsync.mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    render(<TestHarness />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Dispositivo potenzialmente compromesso",
        expect.stringContaining("rootato o jailbroken")
      );
    });
  });

  it("non mostra nulla su un device non compromesso", async () => {
    const Device = jest.requireMock("expo-device") as {
      isRootedExperimentalAsync: jest.Mock;
    };
    Device.isRootedExperimentalAsync.mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    render(<TestHarness />);

    await waitFor(() => {
      expect(Device.isRootedExperimentalAsync).toHaveBeenCalled();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("non esplode se il check nativo stesso fallisce", async () => {
    const Device = jest.requireMock("expo-device") as {
      isRootedExperimentalAsync: jest.Mock;
    };
    Device.isRootedExperimentalAsync.mockRejectedValue(new Error("not available"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    render(<TestHarness />);

    await waitFor(() => {
      expect(Device.isRootedExperimentalAsync).toHaveBeenCalled();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

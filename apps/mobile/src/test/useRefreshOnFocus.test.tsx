import { act, renderHook } from "@testing-library/react-native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";

function mockNavigation(): {
  navigation: NavigationProp<ParamListBase>;
  emitFocus: () => void;
} {
  let focusListener: (() => void) | undefined;
  const navigation = {
    addListener: jest.fn((event: string, listener: () => void) => {
      if (event === "focus") {
        focusListener = listener;
      }
      return jest.fn();
    }),
  } as unknown as NavigationProp<ParamListBase>;
  return {
    navigation,
    emitFocus: () => focusListener?.(),
  };
}

describe("useRefreshOnFocus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("si sottoscrive all'evento focus di navigation", () => {
    const { navigation } = mockNavigation();
    const onFocus = jest.fn();

    renderHook(() => useRefreshOnFocus(navigation, onFocus));

    expect(navigation.addListener).toHaveBeenCalledWith("focus", expect.any(Function));
  });

  it("richiama sempre la versione più recente di onFocus, non quella catturata al primo render", () => {
    const { navigation, emitFocus } = mockNavigation();
    const firstOnFocus = jest.fn();
    const secondOnFocus = jest.fn();

    const { rerender } = renderHook(
      ({ onFocus }: { onFocus: () => void }) => useRefreshOnFocus(navigation, onFocus),
      {
        initialProps: { onFocus: firstOnFocus },
      }
    );

    rerender({ onFocus: secondOnFocus });
    // Oltre la soglia di debounce, altrimenti questo focus verrebbe
    // ignorato indipendentemente da quale onFocus richiamerebbe.
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    emitFocus();

    expect(firstOnFocus).not.toHaveBeenCalled();
    expect(secondOnFocus).toHaveBeenCalledTimes(1);
    // Un solo addListener nonostante il re-render: l'effetto si
    // risottoscrive solo se cambia `navigation`, non `onFocus`.
    expect(navigation.addListener).toHaveBeenCalledTimes(1);
  });

  it("non richiama onFocus al mount (solo su un vero evento focus)", () => {
    const { navigation } = mockNavigation();
    const onFocus = jest.fn();

    renderHook(() => useRefreshOnFocus(navigation, onFocus));

    expect(onFocus).not.toHaveBeenCalled();
  });

  it("ignora un focus troppo vicino al mount (dati appena caricati dal fetch iniziale)", () => {
    const { navigation, emitFocus } = mockNavigation();
    const onFocus = jest.fn();

    renderHook(() => useRefreshOnFocus(navigation, onFocus));

    // Cambio tab veloce, es. Dashboard -> Statistiche -> Dashboard in 2s:
    // il fetch di mount ha appena caricato dati freschi, non serve rifarlo.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    emitFocus();

    expect(onFocus).not.toHaveBeenCalled();
  });

  it("un focus oltre la soglia rifà il fetch; un secondo focus troppo ravvicinato al primo viene ignorato", () => {
    const { navigation, emitFocus } = mockNavigation();
    const onFocus = jest.fn();

    renderHook(() => useRefreshOnFocus(navigation, onFocus));

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    emitFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    emitFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("richiama onFocus di nuovo una volta superata la soglia dall'ultimo refresh andato a buon fine", () => {
    const { navigation, emitFocus } = mockNavigation();
    const onFocus = jest.fn();

    renderHook(() => useRefreshOnFocus(navigation, onFocus));

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    emitFocus();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    emitFocus();

    expect(onFocus).toHaveBeenCalledTimes(2);
  });
});

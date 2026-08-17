import { renderHook } from "@testing-library/react-native";
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
});

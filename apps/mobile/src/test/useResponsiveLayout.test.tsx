import { renderHook } from "@testing-library/react-native";
import {
  useIsTabletDevice,
  useIsTabletLandscape,
  useResponsiveColumns,
} from "../hooks/useResponsiveLayout";
import { setDeviceDimensions } from "./helpers";

describe("useIsTabletDevice", () => {
  afterEach(() => {
    setDeviceDimensions("phone");
  });

  it("e' false su telefono", () => {
    setDeviceDimensions("phone");
    const { result } = renderHook(() => useIsTabletDevice());
    expect(result.current).toBe(false);
  });

  it("e' true su tablet in portrait e resta true ruotando in landscape", () => {
    setDeviceDimensions("tabletPortrait");
    const { result, rerender } = renderHook(() => useIsTabletDevice());
    expect(result.current).toBe(true);

    setDeviceDimensions("tabletLandscape");
    rerender(undefined);
    expect(result.current).toBe(true);
  });
});

describe("useResponsiveColumns", () => {
  afterEach(() => {
    setDeviceDimensions("phone");
  });

  it("resta a 1 colonna su telefono anche con tetto a 3", () => {
    setDeviceDimensions("phone");
    const { result } = renderHook(() => useResponsiveColumns(3));
    expect(result.current).toBe(1);
  });

  it("sale a 2 colonne su tablet in portrait", () => {
    setDeviceDimensions("tabletPortrait");
    const { result } = renderHook(() => useResponsiveColumns(3));
    expect(result.current).toBe(2);
  });

  it("sale a 3 colonne su tablet in landscape se il tetto lo permette", () => {
    setDeviceDimensions("tabletLandscape");
    const { result } = renderHook(() => useResponsiveColumns(3));
    expect(result.current).toBe(3);
  });

  it("rispetta un tetto di 2 colonne anche su tablet in landscape", () => {
    setDeviceDimensions("tabletLandscape");
    const { result } = renderHook(() => useResponsiveColumns(2));
    expect(result.current).toBe(2);
  });
});

describe("useIsTabletLandscape", () => {
  afterEach(() => {
    setDeviceDimensions("phone");
  });

  it("e' false su tablet in portrait", () => {
    setDeviceDimensions("tabletPortrait");
    const { result } = renderHook(() => useIsTabletLandscape());
    expect(result.current).toBe(false);
  });

  it("e' true su tablet in landscape", () => {
    setDeviceDimensions("tabletLandscape");
    const { result } = renderHook(() => useIsTabletLandscape());
    expect(result.current).toBe(true);
  });
});

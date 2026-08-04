import { renderHook } from "@testing-library/react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useOrientationLock } from "../hooks/useOrientationLock";
import { setDeviceDimensions } from "./helpers";

describe("useOrientationLock", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setDeviceDimensions("phone");
  });

  it("blocca in portrait su telefono", () => {
    setDeviceDimensions("phone");
    const lockSpy = jest.spyOn(ScreenOrientation, "lockAsync");

    renderHook(() => useOrientationLock());

    expect(lockSpy).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  });

  it("sblocca (ALL) su tablet, non unlockAsync", () => {
    setDeviceDimensions("tabletPortrait");
    const lockSpy = jest.spyOn(ScreenOrientation, "lockAsync");
    const unlockSpy = jest.spyOn(ScreenOrientation, "unlockAsync");

    renderHook(() => useOrientationLock());

    expect(lockSpy).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.ALL);
    expect(unlockSpy).not.toHaveBeenCalled();
  });
});

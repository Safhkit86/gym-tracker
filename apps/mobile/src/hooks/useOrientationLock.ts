import { useEffect } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { useIsTabletDevice } from "./useResponsiveLayout";

/** Blocca l'orientamento in portrait sul telefono, lo sblocca sul tablet —
 *  chiamato una volta da App.tsx, stesso pattern "configurazione nativa una
 *  tantum al mount" di setAudioModeAsync li' accanto. Hook a parte (non
 *  dentro useResponsiveLayout.ts, che deve restare puro/senza effetti
 *  collaterali nativi, per restare facile da testare).
 *
 *  lockAsync(ALL) e non unlockAsync() per il ramo tablet: unlockAsync()
 *  riporta alla policy DEFAULT, che su Android delega alla rotazione
 *  automatica di sistema (SCREEN_ORIENTATION_UNSPECIFIED) — se l'utente ha
 *  la rotazione automatica disattivata (o durante la verifica su
 *  emulatore, dove si disattiva apposta per pilotarla via adb), l'app
 *  resterebbe ferma in portrait nonostante il "tablet libero di ruotare".
 *  ALL mappa su SCREEN_ORIENTATION_FULL_SENSOR, che ignora l'auto-rotate
 *  di sistema ed è deterministico. */
export function useOrientationLock(): void {
  const isTablet = useIsTabletDevice();

  useEffect(() => {
    if (isTablet) {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
    } else {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [isTablet]);
}

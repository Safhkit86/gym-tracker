import "./i18n";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./auth/AuthProvider";
import { RootNavigator } from "./navigation/RootNavigator";
import { useOrientationLock } from "./hooks/useOrientationLock";

export function App() {
  // Sveglia del timer di recupero udibile anche a interruttore silenzioso
  // attivo (iOS): playsInSilentMode e' gia' true di default in expo-audio,
  // ma va comunque impostato esplicitamente qui (una tantum, non per ogni
  // timer) come cuscinetto contro un cambio di default in una futura SDK.
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  // Telefono bloccato in portrait, tablet libero di ruotare — vedi
  // useOrientationLock per il dettaglio della primitiva usata.
  // app.json ("orientation": "default") lascia entrambi gli orientamenti
  // abilitati a livello nativo di default: necessario perche' su iOS
  // "orientation": "portrait" scriverebbe un tetto rigido in Info.plist
  // (UISupportedInterfaceOrientations) che lockAsync(ALL) non potrebbe mai
  // superare a runtime — il blocco/sblocco per-dispositivo e' quindi
  // responsabilita' esclusiva di questo hook, non della config statica.
  useOrientationLock();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

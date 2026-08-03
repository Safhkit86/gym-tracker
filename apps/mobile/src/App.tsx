import "./i18n";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./auth/AuthProvider";
import { RootNavigator } from "./navigation/RootNavigator";

export function App() {
  // Sveglia del timer di recupero udibile anche a interruttore silenzioso
  // attivo (iOS): playsInSilentMode e' gia' true di default in expo-audio,
  // ma va comunque impostato esplicitamente qui (una tantum, non per ogni
  // timer) come cuscinetto contro un cambio di default in una futura SDK.
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

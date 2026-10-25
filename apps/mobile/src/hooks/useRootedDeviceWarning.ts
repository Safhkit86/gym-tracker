import { useEffect } from "react";
import { Alert } from "react-native";
import * as Device from "expo-device";
import { useTranslation } from "react-i18next";

/** Avviso non bloccante se il device risulta rootato (Android) o jailbroken
 *  (iOS): un device compromesso ha disattivato il sandboxing del sistema,
 *  quindi il token salvato in SecureStore e' potenzialmente leggibile anche
 *  fuori dall'app. Solo un avviso, non un blocco (deciso con l'utente): un
 *  falso positivo o un utente che ha rootato il telefono per altri motivi
 *  non deve perdere l'accesso all'app.
 *
 *  isRootedExperimentalAsync() e' un modulo Expo "core" (gia' incluso nel
 *  binario di Expo Go, a differenza di una libreria come jail-monkey che
 *  richiederebbe una build nativa custom, vedi CLAUDE.md sul vincolo
 *  analogo di react-native-reanimated) — ma Expo lo etichetta lei stessa
 *  "experimental": copre i vettori piu' comuni (binari su, build tag
 *  test-keys, Cydia su iOS), non e' una garanzia assoluta contro tecniche
 *  di hooking/mascheramento più sofisticate.
 *
 *  Una volta per ogni avvio dell'app (non per ogni cambio di schermata, non
 *  persistito tra avvii): nessuno stato da gestire, e se il device resta
 *  compromesso l'utente lo rivede comunque al prossimo avvio. */
export function useRootedDeviceWarning(): void {
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    Device.isRootedExperimentalAsync()
      .then((isRooted) => {
        if (isRooted && !cancelled) {
          Alert.alert(t("security.rootedWarningTitle"), t("security.rootedWarningMessage"));
        }
      })
      .catch(() => {
        /* "experimental": se il check stesso fallisce, non blocchiamo l'app
         * per questo — nessun avviso e' meglio di un crash all'avvio. */
      });
    return () => {
      cancelled = true;
    };
  }, [t]);
}

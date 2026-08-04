import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  DarkTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import { useAuth } from "../auth/useAuth";
import { NotificationsProvider } from "../notifications/NotificationsProvider";
import { colors } from "../theme/theme";
import { AuthNavigator, type AuthStackParamList } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";

// Deep link per il link di reset password ricevuto via email
// (gymtracker://reset-password?token=...). In Expo Go lo scheme
// personalizzato non funziona direttamente: Linking.createURL() genera
// invece un URL exp://<ip-dev-server>:8081/--/... valido durante lo
// sviluppo (documentazione ufficiale Expo) — entrambi i prefissi sono
// necessari perché la build finale (EAS) userà solo lo scheme vero.
// Se il link arriva mentre l'utente è già loggato, è montato
// MainTabNavigator invece di AuthNavigator e la rotta ResetPassword non
// si risolve: limite accettato, nell'uso reale si reimposta la password
// da disconnessi.
const linking: LinkingOptions<AuthStackParamList> = {
  prefixes: [Linking.createURL("/"), "gymtracker://"],
  config: {
    screens: {
      ResetPassword: "reset-password",
    },
  },
};

// Tema di navigazione basato su Night Track invece del default Material/
// Cupertino di React Navigation, per coerenza con il resto dell'app.
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

/** Sceglie lo stack di navigazione in base allo stato di autenticazione,
 *  stesso ruolo di ProtectedRoute + le rotte pubbliche in apps/web/src/App.tsx. */
export function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NotificationsProvider>
      <NavigationContainer theme={navigationTheme} linking={linking}>
        {token ? <MainTabNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </NotificationsProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});

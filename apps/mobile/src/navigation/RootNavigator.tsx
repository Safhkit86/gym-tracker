import { ActivityIndicator, StyleSheet, View } from "react-native";
import { DarkTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { useAuth } from "../auth/useAuth";
import { NotificationsProvider } from "../notifications/NotificationsProvider";
import { colors } from "../theme/theme";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";

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
      <NavigationContainer theme={navigationTheme}>
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

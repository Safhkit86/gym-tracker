import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";

export type DashboardStackParamList = {
  DashboardHome: undefined;
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

/** Stack a una sola schermata: stesso motivo di WorkoutsNavigator/
 *  HistoryNavigator, ottenere l'header nativo (titolo, safe area) gratis
 *  invece di reinventarlo a mano nella tab bar principale (dove
 *  headerShown e' false globalmente). Nome schermata diverso da quello
 *  della tab esterna ("Dashboard" in MainTabNavigator): stesso nome
 *  annidato genera un warning React Navigation ("Found screens with the
 *  same name nested inside"), vedi HistoryNavigator per il precedente. */
export function DashboardNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="DashboardHome"
        component={DashboardScreen}
        options={{ title: t("nav.dashboard") }}
      />
    </Stack.Navigator>
  );
}

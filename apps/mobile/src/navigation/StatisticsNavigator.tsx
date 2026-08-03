import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { StatisticsScreen } from "../screens/statistics/StatisticsScreen";

export type StatisticsStackParamList = {
  StatisticsHome: undefined;
};

const Stack = createNativeStackNavigator<StatisticsStackParamList>();

/** Stack a una sola schermata: stesso motivo di WorkoutsNavigator/
 *  HistoryNavigator/DashboardNavigator, ottenere l'header nativo (titolo,
 *  safe area) gratis invece di reinventarlo a mano nella tab bar principale
 *  (dove headerShown e' false globalmente). Nome schermata diverso da quello
 *  della tab esterna ("Statistics" in MainTabNavigator): stesso nome
 *  annidato genera un warning React Navigation ("Found screens with the
 *  same name nested inside"), vedi HistoryNavigator per il precedente. */
export function StatisticsNavigator() {
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
        name="StatisticsHome"
        component={StatisticsScreen}
        options={{ title: t("nav.statistics") }}
      />
    </Stack.Navigator>
  );
}

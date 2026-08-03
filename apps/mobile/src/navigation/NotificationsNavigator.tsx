import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";

export type NotificationsStackParamList = {
  NotificationsHome: undefined;
};

const Stack = createNativeStackNavigator<NotificationsStackParamList>();

/** Stack a una sola schermata: stesso motivo di WorkoutsNavigator/
 *  HistoryNavigator/DashboardNavigator/StatisticsNavigator, ottenere
 *  l'header nativo (titolo, safe area) gratis invece di reinventarlo a mano
 *  nella tab bar principale (dove headerShown e' false globalmente). Nome
 *  schermata diverso da quello della tab esterna ("Notifications" in
 *  MainTabNavigator): stesso nome annidato genera un warning React
 *  Navigation ("Found screens with the same name nested inside"), vedi
 *  HistoryNavigator per il precedente. */
export function NotificationsNavigator() {
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
        name="NotificationsHome"
        component={NotificationsScreen}
        options={{ title: t("nav.notifications") }}
      />
    </Stack.Navigator>
  );
}

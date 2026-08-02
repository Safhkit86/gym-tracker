import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { WorkoutsNavigator } from "./WorkoutsNavigator";

export type MainTabParamList = {
  Dashboard: undefined;
  Workouts: undefined;
  History: undefined;
  Statistics: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Glifi testuali invece di un'icon library dedicata: sono solo schermate
// segnaposto in questa sotto-fase, un pacchetto icone si aggiunge quando le
// tab avranno contenuto vero (stesso principio "non costruire finche' non
// serve" del resto del progetto).
const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: "⌂",
  Workouts: "▤",
  History: "↺",
  Statistics: "▲",
  Notifications: "🔔",
};

function TabIcon({ route, color }: { route: keyof MainTabParamList; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{TAB_ICONS[route]}</Text>;
}

export function MainTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ color }) => (
          <TabIcon route={route.name as keyof MainTabParamList} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        options={{ title: t("nav.dashboard") }}
        children={() => <PlaceholderScreen title={t("nav.dashboard")} />}
      />
      <Tab.Screen
        name="Workouts"
        options={{ title: t("nav.workouts") }}
        component={WorkoutsNavigator}
      />
      <Tab.Screen
        name="History"
        options={{ title: t("nav.history") }}
        children={() => <PlaceholderScreen title={t("nav.history")} />}
      />
      <Tab.Screen
        name="Statistics"
        options={{ title: t("nav.statistics") }}
        children={() => <PlaceholderScreen title={t("nav.statistics")} />}
      />
      <Tab.Screen
        name="Notifications"
        options={{ title: t("nav.notifications") }}
        children={() => <PlaceholderScreen title={t("nav.notifications")} />}
      />
    </Tab.Navigator>
  );
}

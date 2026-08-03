import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { DashboardNavigator } from "./DashboardNavigator";
import { HistoryNavigator } from "./HistoryNavigator";
import { WorkoutsNavigator, type WorkoutsStackParamList } from "./WorkoutsNavigator";

export type MainTabParamList = {
  Dashboard: undefined;
  // NavigatorScreenParams invece di undefined: la Dashboard naviga dentro lo
  // stack Workouts (es. "Avvia sessione" -> LogSession) da un'altra tab,
  // serve per tipizzare correttamente la navigazione cross-tab annidata.
  Workouts: NavigatorScreenParams<WorkoutsStackParamList> | undefined;
  History: undefined;
  Statistics: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Glifi testuali invece di un'icon library dedicata: sono solo schermate
// segnaposto in questa sotto-fase, un pacchetto icone si aggiunge quando le
// tab avranno contenuto vero (stesso principio "non costruire finche' non
// serve" del resto del progetto). "✉" invece del più ovvio "🔔": quest'ultimo
// ha presentazione emoji di default (sempre a colori, ignora la prop `color`
// di TabIcon), mentre gli altri quattro sono glifi testuali monocromatici che
// ereditano correttamente il tint attivo/inattivo — "✉" (Dingbats, come "‼")
// ha presentazione testuale di default e si comporta come gli altri.
const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: "⌂",
  Workouts: "▤",
  History: "↺",
  Statistics: "▲",
  Notifications: "✉",
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
        component={DashboardNavigator}
      />
      <Tab.Screen
        name="Workouts"
        options={{ title: t("nav.workouts") }}
        component={WorkoutsNavigator}
      />
      <Tab.Screen
        name="History"
        options={{ title: t("nav.history") }}
        component={HistoryNavigator}
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

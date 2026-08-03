import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { HistoryScreen } from "../screens/history/HistoryScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { ProfileHeaderButton } from "../components/ProfileHeaderButton";

export type HistoryStackParamList = {
  HistoryHome: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<HistoryStackParamList>();

/** Stack a una sola schermata "vera" (Profilo e' condiviso, pushato da
 *  qui e dagli altri 4 *Navigator): stesso motivo di WorkoutsNavigator,
 *  ottenere l'header nativo (titolo, safe area) gratis invece di
 *  reinventarlo a mano nella tab bar principale (dove headerShown e'
 *  false globalmente). Nome schermata diverso da quello della tab
 *  esterna ("History" in MainTabNavigator): stesso nome annidato genera
 *  un warning React Navigation ("Found screens with the same name
 *  nested inside"). */
export function HistoryNavigator() {
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
        name="HistoryHome"
        component={HistoryScreen}
        options={({ navigation }) => ({
          title: t("nav.history"),
          headerRight: () => <ProfileHeaderButton onPress={() => navigation.navigate("Profile")} />,
        })}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("profile.title") }}
      />
    </Stack.Navigator>
  );
}

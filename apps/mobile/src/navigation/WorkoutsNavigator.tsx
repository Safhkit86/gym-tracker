import { Text, TouchableOpacity, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors, spacing } from "../theme/theme";
import { WorkoutsListScreen } from "../screens/workouts/WorkoutsListScreen";
import { WorkoutDetailScreen } from "../screens/workouts/WorkoutDetailScreen";
import { CreateWorkoutScreen } from "../screens/workouts/CreateWorkoutScreen";
import { EditWorkoutScreen } from "../screens/workouts/EditWorkoutScreen";
import { LogSessionScreen } from "../screens/workouts/LogSessionScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { ProfileHeaderButton } from "../components/ProfileHeaderButton";

export type WorkoutsStackParamList = {
  WorkoutsList: undefined;
  WorkoutDetail: { id: string };
  CreateWorkout: undefined;
  EditWorkout: { id: string };
  LogSession: { id: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export function WorkoutsNavigator() {
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
        name="WorkoutsList"
        component={WorkoutsListScreen}
        options={({ navigation }) => ({
          title: t("nav.workouts"),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => navigation.navigate("CreateWorkout")}
                accessibilityRole="button"
                accessibilityLabel={t("workouts.list.newWorkout")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: colors.accent, fontSize: 28, marginRight: spacing.sm }}>
                  +
                </Text>
              </TouchableOpacity>
              <ProfileHeaderButton onPress={() => navigation.navigate("Profile")} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ title: t("workouts.detail.title") }}
      />
      <Stack.Screen
        name="CreateWorkout"
        component={CreateWorkoutScreen}
        options={{ title: t("workouts.create.title") }}
      />
      <Stack.Screen
        name="EditWorkout"
        component={EditWorkoutScreen}
        options={{ title: t("workouts.edit.title") }}
      />
      <Stack.Screen
        name="LogSession"
        component={LogSessionScreen}
        // Senza getId, navigare di nuovo su "LogSession" con un id diverso
        // (es. da Dashboard, scheda del giorno dopo) riusa l'istanza già
        // presente nello stack invece di crearne una nuova: lo stato locale
        // della schermata precedente (es. "sessione registrata" dopo un
        // invio) restava visibile finché non lo si toccava — bug segnalato
        // dall'utente ("avvio la sessione di venerdì, mi riporta su quella
        // di giovedì già inviata"). getId dice a React Navigation di
        // trattare id diversi come schermate diverse (una nuova istanza),
        // coerente con com'è già la webapp, dove ogni /sessions/log/:id è
        // una pagina distinta.
        getId={({ params }) => params.id}
        options={{ title: t("session.title") }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("profile.title") }}
      />
    </Stack.Navigator>
  );
}

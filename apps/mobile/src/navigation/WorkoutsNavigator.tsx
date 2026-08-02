import { Text, TouchableOpacity } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors, spacing } from "../theme/theme";
import { WorkoutsListScreen } from "../screens/workouts/WorkoutsListScreen";
import { WorkoutDetailScreen } from "../screens/workouts/WorkoutDetailScreen";
import { CreateWorkoutScreen } from "../screens/workouts/CreateWorkoutScreen";
import { EditWorkoutScreen } from "../screens/workouts/EditWorkoutScreen";

export type WorkoutsStackParamList = {
  WorkoutsList: undefined;
  WorkoutDetail: { id: string };
  CreateWorkout: undefined;
  EditWorkout: { id: string };
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
            <TouchableOpacity
              onPress={() => navigation.navigate("CreateWorkout")}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.list.newWorkout")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: colors.accent, fontSize: 28, marginRight: spacing.sm }}>+</Text>
            </TouchableOpacity>
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
    </Stack.Navigator>
  );
}

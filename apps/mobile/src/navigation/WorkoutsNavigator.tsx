import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/theme";
import { WorkoutsListScreen } from "../screens/workouts/WorkoutsListScreen";
import { WorkoutDetailScreen } from "../screens/workouts/WorkoutDetailScreen";

export type WorkoutsStackParamList = {
  WorkoutsList: undefined;
  WorkoutDetail: { id: string };
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
        options={{ title: t("nav.workouts") }}
      />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ title: t("workouts.detail.title") }}
      />
    </Stack.Navigator>
  );
}

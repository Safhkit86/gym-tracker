import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { Exercise, WorkoutDetail, WorkoutInput } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { listExercises } from "../../api/exercises";
import { getWorkout, updateWorkout } from "../../api/workouts";
import { ApiRequestError } from "../../api/client";
import { colors } from "../../theme/theme";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";
import { WorkoutForm } from "./WorkoutForm";
import { workoutDetailToFormValues } from "../../utils/workout-form-utils";
import { styles } from "./workout-form-screen-styles";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "EditWorkout">;

export function EditWorkoutScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { id } = route.params;
  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    Promise.all([listExercises(token), getWorkout(token, id)])
      .then(([catalogResult, workoutResult]) => {
        if (!cancelled) {
          setCatalog(catalogResult);
          setWorkout(workoutResult);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError ? err.message : t("workouts.create.loadError")
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, id, t]);

  async function handleSubmit(input: WorkoutInput): Promise<void> {
    if (!token) {
      return;
    }
    const result = await updateWorkout(token, id, input);
    navigation.replace("WorkoutDetail", { id: result.id });
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {loadError}
        </Text>
      </View>
    );
  }

  if (catalog === null || workout === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (catalog.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t("workouts.create.emptyCatalog")}</Text>
      </View>
    );
  }

  const initialValues = workoutDetailToFormValues(workout);

  return (
    <WorkoutForm
      catalog={catalog}
      initialName={initialValues.name}
      initialNotes={initialValues.notes}
      initialExercises={initialValues.exercises}
      submitLabel={t("workouts.edit.submit")}
      submittingLabel={t("workouts.edit.submitting")}
      onSubmit={handleSubmit}
    />
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { WorkoutSummary } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { listWorkouts } from "../../api/workouts";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import { ResponsiveCardColumns } from "../../components/ResponsiveCardColumns";
import {
  useResponsiveColumns,
  useSafeAreaHorizontalPadding,
} from "../../hooks/useResponsiveLayout";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "WorkoutsList">;

export function WorkoutsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const columns = useResponsiveColumns(3);
  const safeAreaPadding = useSafeAreaHorizontalPadding();
  const [workouts, setWorkouts] = useState<WorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await listWorkouts(token);
      if (isMountedRef.current) {
        setWorkouts(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
      }
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rifà il fetch anche al ritorno in primo piano sulla schermata: senza,
  // creare/duplicare una scheda e poi tornare qui (via "indietro") mostrava
  // ancora l'elenco di prima del mount, senza le nuove schede — riportato
  // dall'utente. Vedi useRefreshOnFocus.
  useRefreshOnFocus(navigation, load);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      </View>
    );
  }

  if (workouts === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (workouts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t("workouts.list.empty")}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.list, safeAreaPadding]} contentContainerStyle={styles.listContent}>
      <ResponsiveCardColumns columns={columns}>
        {workouts.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate("WorkoutDetail", { id: item.id })}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.notes && (
              <Text style={styles.cardNotes} numberOfLines={1}>
                {item.notes}
              </Text>
            )}
            <Text style={styles.cardMeta}>
              {t("workouts.list.exerciseCount", { count: item.exerciseCount })}
            </Text>
          </TouchableOpacity>
        ))}
      </ResponsiveCardColumns>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  cardNotes: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  cardMeta: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
});

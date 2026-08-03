import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import type {
  DashboardStats,
  Exercise,
  ExerciseHistoryPoint,
  MeasurementEntry,
} from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { getDashboardStats, getExerciseHistory } from "../../api/stats";
import { listExercises } from "../../api/exercises";
import { getWorkout, listWorkouts } from "../../api/workouts";
import { listMeasurements } from "../../api/measurements";
import { ApiRequestError } from "../../api/client";
import { StatisticheCard } from "../../components/StatisticheCard";
import { MiniLineChart } from "../../components/MiniLineChart";
import {
  UNSPECIFIED_MUSCLE_GROUP,
  normalizeMuscleGroup,
  groupVolumeByMuscleGroup,
  sortExerciseGroups,
  type ExerciseRef,
} from "../../utils/muscle-groups";
import { MEASUREMENT_FIELDS } from "../../utils/measurements";
import { colors, radius, spacing } from "../../theme/theme";

type StatisticsTab = "sessions" | "measurements";

export function StatisticsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [tab, setTab] = useState<StatisticsTab>("sessions");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentSchedeExercises, setCurrentSchedeExercises] = useState<ExerciseRef[]>([]);
  const [exerciseHistories, setExerciseHistories] = useState<Map<string, ExerciseHistoryPoint[]>>(
    new Map()
  );
  const [error, setError] = useState<string | null>(null);

  const [measurements, setMeasurements] = useState<MeasurementEntry[] | null>(null);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;

    async function load(authToken: string): Promise<void> {
      try {
        const [statsResult, exercisesResult, workoutsResult] = await Promise.all([
          getDashboardStats(authToken),
          listExercises(authToken),
          listWorkouts(authToken),
        ]);
        if (cancelled) {
          return;
        }
        setStats(statsResult);
        setExercises(exercisesResult);

        if (workoutsResult.length > 0) {
          const workoutDetails = await Promise.all(
            workoutsResult.map((w) => getWorkout(authToken, w.id))
          );
          if (cancelled) {
            return;
          }
          const exerciseUnion = new Map<string, string>();
          for (const detail of workoutDetails) {
            for (const ex of detail.exercises) {
              exerciseUnion.set(ex.exerciseId, ex.exerciseName);
            }
          }
          setCurrentSchedeExercises(
            [...exerciseUnion.entries()].map(([exerciseId, exerciseName]) => ({
              exerciseId,
              exerciseName,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : t("statistics.loadError"));
        }
      }
    }

    void load(token);
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  useEffect(() => {
    if (!token || currentSchedeExercises.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all(
      currentSchedeExercises.map((ref) =>
        getExerciseHistory(token, ref.exerciseId).then(
          (points) => [ref.exerciseId, points] as const
        )
      )
    )
      .then((entries) => {
        if (!cancelled) {
          setExerciseHistories(new Map(entries));
        }
      })
      .catch(() => {
        /* opzionale: nessun errore bloccante */
      });
    return () => {
      cancelled = true;
    };
  }, [token, currentSchedeExercises]);

  // Caricamento lazy: solo alla prima apertura della vista Misure, stesso
  // motivo dello Storico.
  useEffect(() => {
    if (!token || tab !== "measurements" || measurements !== null) {
      return;
    }
    let cancelled = false;
    listMeasurements(token)
      .then((result) => {
        if (!cancelled) {
          setMeasurements(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMeasurementsError(
            err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, tab, measurements]);

  const muscleGroupByExerciseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ex of exercises) {
      map.set(ex.id, normalizeMuscleGroup(ex.muscleGroup ?? UNSPECIFIED_MUSCLE_GROUP));
    }
    return map;
  }, [exercises]);

  const muscleGroupVolume = useMemo(
    () => (stats ? groupVolumeByMuscleGroup(stats, muscleGroupByExerciseId) : []),
    [stats, muscleGroupByExerciseId]
  );

  const exercisesByMuscleGroup = useMemo(() => {
    const map = new Map<string, ExerciseRef[]>();
    for (const ref of currentSchedeExercises) {
      const muscleGroup = muscleGroupByExerciseId.get(ref.exerciseId) ?? UNSPECIFIED_MUSCLE_GROUP;
      const list = map.get(muscleGroup) ?? [];
      list.push(ref);
      map.set(muscleGroup, list);
    }
    return map;
  }, [currentSchedeExercises, muscleGroupByExerciseId]);

  const sortedGroups = useMemo(
    () => sortExerciseGroups(exercisesByMuscleGroup, exerciseHistories),
    [exercisesByMuscleGroup, exerciseHistories]
  );

  // Piu' recenti prima -> per un grafico servono in ordine cronologico
  // crescente (sinistra = piu' vecchio), come lo storico esercizi.
  const measurementsChronological = useMemo(
    () => (measurements ? [...measurements].reverse() : []),
    [measurements]
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t("statistics.subtitle")}</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "sessions" && styles.tabButtonActive]}
          onPress={() => setTab("sessions")}
          accessibilityRole="button"
          accessibilityLabel={t("statistics.sessionsTab")}
        >
          <Text style={[styles.tabButtonText, tab === "sessions" && styles.tabButtonTextActive]}>
            {t("statistics.sessionsTab")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "measurements" && styles.tabButtonActive]}
          onPress={() => setTab("measurements")}
          accessibilityRole="button"
          accessibilityLabel={t("statistics.measurementsTab")}
        >
          <Text
            style={[styles.tabButtonText, tab === "measurements" && styles.tabButtonTextActive]}
          >
            {t("statistics.measurementsTab")}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "sessions" ? (
        <>
          <StatisticheCard stats={stats} muscleGroupVolume={muscleGroupVolume} />
          {sortedGroups.length === 0 ? (
            <Text style={styles.infoText}>{t("statistics.noData")}</Text>
          ) : (
            sortedGroups.map(([muscleGroup, exercisesInGroup]) => (
              <View style={styles.card} key={muscleGroup}>
                <Text style={styles.cardTitle}>{muscleGroup}</Text>
                {exercisesInGroup.map((ref, index) => {
                  const points = exerciseHistories.get(ref.exerciseId) ?? [];
                  const latest = points[points.length - 1];
                  const unitLabel =
                    latest?.unit === "reps"
                      ? t("dashboard.progressions.unitReps")
                      : t("dashboard.progressions.unitWeight");
                  return (
                    <View
                      key={ref.exerciseId}
                      style={[styles.chartBlock, index > 0 && styles.chartBlockDivider]}
                    >
                      <View style={styles.chartHeader}>
                        <Text
                          style={styles.chartTitle}
                        >{`${ref.exerciseName} — ${unitLabel}`}</Text>
                        {latest && (
                          <Text style={styles.chartLatest}>
                            {latest.unit === "kg"
                              ? `${latest.value}kg`
                              : `${latest.value} ${t("dashboard.repsShort")}`}
                          </Text>
                        )}
                      </View>
                      <MiniLineChart
                        points={points.map((p) => ({
                          id: p.sessionId,
                          date: p.performedAt,
                          value: p.value,
                        }))}
                        unit={latest?.unit ?? "kg"}
                        emptyMessage={t("dashboard.progressions.chartEmpty")}
                      />
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </>
      ) : (
        <View style={styles.card}>
          {measurementsError && (
            <Text style={styles.error} accessibilityRole="alert">
              {measurementsError}
            </Text>
          )}
          {measurements === null && !measurementsError && (
            <Text style={styles.infoText}>{t("common.loading")}</Text>
          )}
          {measurements?.length === 0 && (
            <Text style={styles.infoText}>{t("statistics.noMeasurements")}</Text>
          )}
          {measurements &&
            measurements.length > 0 &&
            MEASUREMENT_FIELDS.map((field) => {
              const points = measurementsChronological
                .filter((entry) => entry[field.key] !== null)
                .map((entry) => ({
                  id: entry.id,
                  date: entry.measuredOn,
                  value: entry[field.key] as number,
                }));
              const latest = points[points.length - 1];
              const label = t(`history.measurements.${field.key}`);
              return (
                <View key={field.key} style={styles.chartBlock}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>{`${label} — ${field.unit}`}</Text>
                    {latest && (
                      <Text style={styles.chartLatest}>{`${latest.value}${field.unit}`}</Text>
                    )}
                  </View>
                  <MiniLineChart
                    points={points}
                    unit={field.unit}
                    emptyMessage={t("statistics.noMeasurementFor", {
                      label: label.toLowerCase(),
                    })}
                  />
                </View>
              );
            })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: colors.accentContrast,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  chartBlock: {
    gap: spacing.xs,
  },
  chartBlockDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  chartTitle: {
    color: colors.text,
    fontSize: 13,
    flexShrink: 1,
  },
  chartLatest: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

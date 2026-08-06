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
import type { TFunction } from "i18next";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  DashboardStats,
  Exercise,
  ExerciseHistoryPoint,
  MeasurementEntry,
  Notification,
  SessionDetail,
  SessionExercise,
  StalledExercise,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSummary,
} from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { useUnreadCount } from "../../notifications/useUnreadCount";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import type { DashboardStackParamList } from "../../navigation/DashboardNavigator";
import { formatSuggestionDelta, toOverride } from "../../utils/suggestion-format";
import { getDashboardStats, getExerciseHistory, getStalledExercise } from "../../api/stats";
import { listExercises } from "../../api/exercises";
import { getWorkout, listWorkouts } from "../../api/workouts";
import { listSessions } from "../../api/sessions";
import { listMeasurements } from "../../api/measurements";
import { listNotifications, markNotificationRead } from "../../api/notifications";
import { acceptProgressionDefaults } from "../../api/profile";
import { ApiRequestError } from "../../api/client";
import { VerticalPeekList } from "../../components/VerticalPeekList";
import { MiniLineChart } from "../../components/MiniLineChart";
import { MeasureTilesGrid } from "../../components/MeasureTilesGrid";
import { StreakCalendar } from "../../components/StreakCalendar";
import { StatisticheCard } from "../../components/StatisticheCard";
import { ResponsiveCardColumns } from "../../components/ResponsiveCardColumns";
import {
  useResponsiveColumns,
  useSafeAreaHorizontalPadding,
} from "../../hooks/useResponsiveLayout";
import {
  UNSPECIFIED_MUSCLE_GROUP,
  normalizeMuscleGroup,
  groupVolumeByMuscleGroup,
  sortExerciseGroups,
  type ExerciseRef,
} from "../../utils/muscle-groups";
import { computeMeasureTiles } from "../../utils/measurements";
import { formatItemIndicator } from "../../utils/item-indicator";
import { colors, radius, spacing } from "../../theme/theme";

// CompositeScreenProps: DashboardScreen vive in DashboardNavigator (stack a
// una schermata) ma deve navigare anche verso altre tab (es. "Avvia
// sessione" -> Workouts>LogSession, "Vedi tutte" -> Notifications/
// Statistics) — la prop navigation deve quindi combinare i metodi dello
// stack locale con quelli del tab navigator genitore.
export type Props = CompositeScreenProps<
  NativeStackScreenProps<DashboardStackParamList, "DashboardHome">,
  BottomTabScreenProps<MainTabParamList>
>;

function formatWorkoutPrescription(exercise: WorkoutExercise, t: TFunction): string {
  const setCount = exercise.sets.length;
  const first = exercise.sets[0];
  const setsLabel = t("dashboard.setsCount", { count: setCount });
  if (!first) {
    return setsLabel;
  }
  const reps = first.isMaxEffort
    ? t("workouts.detail.maxEffort")
    : first.targetMaxReps !== null
      ? `${first.targetMinReps}-${first.targetMaxReps} ${t("dashboard.repsShort")}`
      : `${first.targetMinReps} ${t("dashboard.repsShort")}`;
  const weight =
    first.targetWeight !== null
      ? t("dashboard.weightTarget", { weight: first.targetWeight })
      : t("workouts.detail.bodyweight");
  return `${setsLabel} · ${reps} · ${weight}`;
}

function formatSessionExerciseSummary(exercise: SessionExercise, t: TFunction): string {
  const reps = exercise.sets.map((s) => s.actualReps).join(", ");
  const weight = exercise.sets[0]?.actualWeight;
  const weightLabel =
    weight !== null && weight !== undefined ? `${weight}kg` : t("workouts.detail.bodyweight");
  return `${reps} ${t("dashboard.repsShort")} · ${weightLabel}`;
}

export function DashboardScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { refreshUnreadCount } = useUnreadCount();
  const columns = useResponsiveColumns(3);
  const safeAreaPadding = useSafeAreaHorizontalPadding();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [nextWorkout, setNextWorkout] = useState<WorkoutDetail | null>(null);
  const [lastSession, setLastSession] = useState<SessionDetail | null>(null);
  const [currentSchedeExercises, setCurrentSchedeExercises] = useState<ExerciseRef[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<Notification[]>([]);
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());
  const [stalledExercise, setStalledExercise] = useState<StalledExercise | null>(null);
  const [exerciseHistories, setExerciseHistories] = useState<Map<string, ExerciseHistoryPoint[]>>(
    new Map()
  );
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;

    async function load(authToken: string): Promise<void> {
      try {
        const [statsResult, exercisesResult, workoutsResult, sessionsResult] = await Promise.all([
          getDashboardStats(authToken),
          listExercises(authToken),
          listWorkouts(authToken),
          listSessions(authToken, 1),
        ]);
        if (cancelled) {
          return;
        }
        setStats(statsResult);
        setExercises(exercisesResult);
        const last = sessionsResult[0] ?? null;
        setLastSession(last);

        if (workoutsResult.length > 0) {
          const workoutDetails = await Promise.all(
            workoutsResult.map((w: WorkoutSummary) => getWorkout(authToken, w.id))
          );
          if (cancelled) {
            return;
          }

          const lastIndex = last
            ? workoutsResult.findIndex((w: WorkoutSummary) => w.id === last.workoutId)
            : -1;
          const nextIndex = (lastIndex + 1) % workoutsResult.length;
          setNextWorkout(workoutDetails[nextIndex] ?? null);

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
          setError(err instanceof ApiRequestError ? err.message : t("dashboard.loadError"));
        }
        return;
      }

      // Sezioni secondarie: un fallimento qui non deve impedire la
      // visualizzazione del resto della pagina (stesso pattern della
      // webapp). Ognuna ha il proprio .catch(), cosi' il fallimento di una
      // non ne impedisce altre.
      Promise.all([listNotifications(authToken, true), getStalledExercise(authToken)])
        .then(([notifications, stalled]) => {
          if (!cancelled) {
            setPendingSuggestions(notifications);
            setStalledExercise(stalled);
          }
        })
        .catch(() => {
          /* opzionale: nessun errore bloccante */
        });

      listMeasurements(authToken)
        .then((measurementsResult) => {
          if (!cancelled) {
            setMeasurements(measurementsResult);
          }
        })
        .catch(() => {
          /* opzionale: nessun errore bloccante */
        });
    }

    void load(token);
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  // Storico per i grafici: solo dopo aver saputo quali esercizi fanno
  // ancora parte delle schede attuali, in parallelo, non bloccante.
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

  async function handleAccept(notification: Notification): Promise<void> {
    if (!token) {
      return;
    }
    const override = toOverride(notification);
    if (!override) {
      return;
    }
    setConfirmingIds((prev) => new Set(prev).add(notification.id));
    try {
      await acceptProgressionDefaults(token, [override]);
      await markNotificationRead(token, notification.id);
      refreshUnreadCount();
      setTimeout(() => {
        setPendingSuggestions((prev) => prev.filter((n) => n.id !== notification.id));
        setConfirmingIds((prev) => {
          const next = new Set(prev);
          next.delete(notification.id);
          return next;
        });
      }, 1200);
    } catch (err) {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
      setError(err instanceof ApiRequestError ? err.message : t("dashboard.suggestions.error"));
    }
  }

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

  const statisticheCard = <StatisticheCard stats={stats} muscleGroupVolume={muscleGroupVolume} />;
  const suggerimentiCard = (
    <SuggerimentiCard
      notifications={pendingSuggestions}
      confirmingIds={confirmingIds}
      onAccept={handleAccept}
      onViewAll={() => navigation.navigate("Notifications")}
    />
  );
  const progressioniCard = (
    <ProgressioniCard
      exercisesByMuscleGroup={exercisesByMuscleGroup}
      exerciseHistories={exerciseHistories}
    />
  );
  const misureCard = (
    <MisureCard measurements={measurements} onViewAll={() => navigation.navigate("Statistics")} />
  );
  const costanzaCard = <CostanzaCard streakCalendar={stats.streakCalendar} />;
  const prossimaSessioneCard = nextWorkout && (
    <ProssimaSessioneCard
      workout={nextWorkout}
      onStart={() =>
        navigation.navigate("Workouts", {
          screen: "LogSession",
          params: { id: nextWorkout.id },
        })
      }
    />
  );
  const ultimaSessioneCard = lastSession && (
    <UltimaSessioneCard session={lastSession} locale={i18n.language} />
  );
  const stalloCard = stalledExercise && <StalloCard stalled={stalledExercise} />;

  return (
    <ScrollView style={[styles.container, safeAreaPadding]} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t("dashboard.subtitle")}</Text>

      {columns === 1 ? (
        // Telefono: nessun ordine esplicito da rispettare (mai chiesto),
        // bucket a colonna singola invariato rispetto a prima.
        <ResponsiveCardColumns columns={1}>
          {statisticheCard}
          {suggerimentiCard}
          {progressioniCard}
          {misureCard}
          {costanzaCard}
          {prossimaSessioneCard}
          {ultimaSessioneCard}
          {stalloCard}
        </ResponsiveCardColumns>
      ) : columns === 2 ? (
        // Tablet verticale: ordine deciso con l'utente su artifact, non il
        // bucket round-robin di ResponsiveCardColumns (che ignorerebbe
        // l'importanza relativa delle card) — due colonne esplicite.
        <View style={styles.columnsRow}>
          <View style={styles.column}>
            {statisticheCard}
            {costanzaCard}
            {stalloCard}
            {progressioniCard}
          </View>
          <View style={styles.column}>
            {suggerimentiCard}
            {prossimaSessioneCard}
            {ultimaSessioneCard}
            {misureCard}
          </View>
        </View>
      ) : (
        // Tablet orizzontale: stesso principio, tre colonne esplicite.
        <View style={styles.columnsRow}>
          <View style={styles.column}>
            {statisticheCard}
            {costanzaCard}
            {misureCard}
          </View>
          <View style={styles.column}>
            {suggerimentiCard}
            {stalloCard}
            {progressioniCard}
          </View>
          <View style={styles.column}>
            {prossimaSessioneCard}
            {ultimaSessioneCard}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function SuggestionRow({
  notification,
  confirmingIds,
  onAccept,
  t,
}: {
  notification: Notification;
  confirmingIds: Set<string>;
  onAccept: (notification: Notification) => void;
  t: TFunction;
}) {
  return (
    <View style={styles.suggestionRow}>
      <View style={styles.suggestionText}>
        <Text style={styles.suggestionName}>{notification.exerciseName}</Text>
        <Text style={styles.suggestionDelta}>
          {formatSuggestionDelta(notification, t("dashboard.suggestions.repsUnit"))}
        </Text>
      </View>
      {confirmingIds.has(notification.id) ? (
        <Text style={styles.suggestionAccepted}>{t("dashboard.suggestions.accepted")}</Text>
      ) : (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => onAccept(notification)}
          accessibilityRole="button"
        >
          <Text style={styles.acceptButtonText}>{t("dashboard.suggestions.accept")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SuggerimentiCard({
  notifications,
  confirmingIds,
  onAccept,
  onViewAll,
}: {
  notifications: Notification[];
  confirmingIds: Set<string>;
  onAccept: (notification: Notification) => void;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const onlyNotification = notifications[0];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t("dashboard.suggestions.title")}</Text>
        <View style={styles.cardHeaderControls}>
          {notifications.length > 1 && (
            <Text style={styles.indicator}>
              {formatItemIndicator(t, index, notifications.length)}
            </Text>
          )}
          <TouchableOpacity onPress={onViewAll} accessibilityRole="button">
            <Text style={styles.link}>{t("dashboard.suggestions.viewAll")}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {notifications.length === 0 ? (
        <Text style={styles.infoText}>{t("dashboard.suggestions.empty")}</Text>
      ) : notifications.length > 1 ? (
        <VerticalPeekList
          items={notifications}
          keyExtractor={(n) => n.id}
          onIndexChange={setIndex}
          renderItem={(n) => (
            <SuggestionRow
              notification={n}
              confirmingIds={confirmingIds}
              onAccept={onAccept}
              t={t}
            />
          )}
        />
      ) : (
        onlyNotification && (
          <SuggestionRow
            notification={onlyNotification}
            confirmingIds={confirmingIds}
            onAccept={onAccept}
            t={t}
          />
        )
      )}
    </View>
  );
}

function ProgressioniCard({
  exercisesByMuscleGroup,
  exerciseHistories,
}: {
  exercisesByMuscleGroup: Map<string, ExerciseRef[]>;
  exerciseHistories: Map<string, ExerciseHistoryPoint[]>;
}) {
  const { t } = useTranslation();
  const sortedGroups = sortExerciseGroups(exercisesByMuscleGroup, exerciseHistories);
  // Solo un accordion aperto alla volta, altrimenti la card cresce troppo
  // con molti gruppi muscolari. null = nessuna scelta esplicita ancora,
  // apri il primo gruppo di default.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const effectiveOpenGroup = openGroup ?? sortedGroups[0]?.[0] ?? null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.progressions.title")}</Text>
      {sortedGroups.length === 0 ? (
        <Text style={styles.infoText}>{t("dashboard.progressions.empty")}</Text>
      ) : (
        sortedGroups.map(([muscleGroup, exercisesInGroup]) => {
          const isOpen = effectiveOpenGroup === muscleGroup;
          return (
            <View style={styles.accordion} key={muscleGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setOpenGroup(isOpen ? null : muscleGroup)}
                accessibilityRole="button"
              >
                <Text style={styles.accordionTitle}>{muscleGroup}</Text>
                <Text style={styles.accordionGlyph}>{isOpen ? "−" : "+"}</Text>
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.accordionBody}>
                  {exercisesInGroup.map((ref) => {
                    const points = exerciseHistories.get(ref.exerciseId) ?? [];
                    const latest = points[points.length - 1];
                    return (
                      <View key={ref.exerciseId} style={styles.exerciseChart}>
                        <View style={styles.exerciseChartHeader}>
                          <Text style={styles.exerciseChartTitle}>
                            {ref.exerciseName} —{" "}
                            {latest?.unit === "reps"
                              ? t("dashboard.progressions.unitReps")
                              : t("dashboard.progressions.unitWeight")}
                          </Text>
                          {latest && (
                            <Text style={styles.exerciseChartLatest}>
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
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

/** Tile compatte per le misure (valore attuale + delta + sparkline), non
 *  mostrate se l'utente non ha ancora registrato nessuna misura. Stessa
 *  logica di apps/web/src/pages/DashboardPage.tsx (MisureCard). Calcolo
 *  tile e rendering griglia estratti (computeMeasureTiles/MeasureTilesGrid)
 *  perché li riusa anche il tab Misure di Statistiche. */
function MisureCard({
  measurements,
  onViewAll,
}: {
  measurements: MeasurementEntry[];
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  const tiles = computeMeasureTiles(measurements);

  if (tiles.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t("dashboard.measurements.title")}</Text>
        <TouchableOpacity onPress={onViewAll} accessibilityRole="button">
          <Text style={styles.link}>{t("dashboard.measurements.viewAll")}</Text>
        </TouchableOpacity>
      </View>
      <MeasureTilesGrid tiles={tiles} />
    </View>
  );
}

function CostanzaCard({ streakCalendar }: { streakCalendar: string[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.streak.title")}</Text>
      <StreakCalendar trainedDates={streakCalendar} />
      <View style={styles.streakLegend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, styles.legendSwatchOn]} />
          <Text style={styles.legendText}>{t("dashboard.streak.trainedLegend")}</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendSwatch} />
          <Text style={styles.legendText}>{t("dashboard.streak.restLegend")}</Text>
        </View>
      </View>
      <Text style={styles.sectionNote}>{t("dashboard.streak.note")}</Text>
    </View>
  );
}

function WorkoutExerciseRow({ exercise, t }: { exercise: WorkoutExercise; t: TFunction }) {
  return (
    <View style={styles.exerciseListRow}>
      <Text style={styles.exerciseListName}>{exercise.exerciseName}</Text>
      <Text style={styles.exerciseListDetail}>{formatWorkoutPrescription(exercise, t)}</Text>
    </View>
  );
}

function ProssimaSessioneCard({
  workout,
  onStart,
}: {
  workout: WorkoutDetail;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const onlyExercise = workout.exercises[0];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t("dashboard.nextSession.title")}</Text>
        {workout.exercises.length > 1 && (
          <Text style={styles.indicator}>
            {formatItemIndicator(t, index, workout.exercises.length)}
          </Text>
        )}
      </View>
      <Text style={styles.cardSubtitleTight}>{workout.name}</Text>
      {workout.exercises.length > 1 ? (
        <VerticalPeekList
          items={workout.exercises}
          keyExtractor={(exercise) => exercise.id}
          onIndexChange={setIndex}
          renderItem={(exercise) => <WorkoutExerciseRow exercise={exercise} t={t} />}
        />
      ) : (
        onlyExercise && <WorkoutExerciseRow exercise={onlyExercise} t={t} />
      )}
      <TouchableOpacity style={styles.startButton} onPress={onStart} accessibilityRole="button">
        <Text style={styles.startButtonText}>{t("dashboard.nextSession.start")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SessionExerciseRow({ exercise, t }: { exercise: SessionExercise; t: TFunction }) {
  return (
    <View style={styles.exerciseListRow}>
      <Text style={styles.exerciseListName}>{exercise.exerciseName}</Text>
      <Text style={styles.exerciseListDetail}>{formatSessionExerciseSummary(exercise, t)}</Text>
    </View>
  );
}

function UltimaSessioneCard({ session, locale }: { session: SessionDetail; locale: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const onlyExercise = session.exercises[0];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t("dashboard.lastSession.title")}</Text>
        {session.exercises.length > 1 && (
          <Text style={styles.indicator}>
            {formatItemIndicator(t, index, session.exercises.length)}
          </Text>
        )}
      </View>
      <Text style={styles.cardSubtitleTight}>
        {session.workoutName} · {new Date(session.performedAt).toLocaleDateString(locale)}
      </Text>
      {session.exercises.length > 1 ? (
        <VerticalPeekList
          items={session.exercises}
          keyExtractor={(exercise) => exercise.exerciseId}
          onIndexChange={setIndex}
          renderItem={(exercise) => <SessionExerciseRow exercise={exercise} t={t} />}
        />
      ) : (
        onlyExercise && <SessionExerciseRow exercise={onlyExercise} t={t} />
      )}
    </View>
  );
}

function StalloCard({ stalled }: { stalled: StalledExercise }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.stalled.title")}</Text>
      <View style={styles.stallCallout}>
        <Text style={styles.stallIcon}>⏸</Text>
        <View style={styles.stallText}>
          <Text style={styles.stallExercise}>{stalled.exerciseName}</Text>
          <Text style={styles.stallDetail}>
            {t("dashboard.stalled.text", {
              weeks: Math.floor(stalled.daysSinceLastProgression / 7),
            })}
          </Text>
        </View>
      </View>
    </View>
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
  // Colonne esplicite per tablet (ordine deciso card-per-card, non bucket
  // round-robin di ResponsiveCardColumns) — stessi valori di row/column lì,
  // per coerenza visiva col resto dell'app.
  columnsRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  column: {
    flex: 1,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitleTight: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: -spacing.xs,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  indicator: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  sectionNote: {
    color: colors.textMuted,
    fontSize: 12,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  suggestionText: {
    gap: 2,
  },
  suggestionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionDelta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  suggestionAccepted: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  acceptButtonText: {
    color: colors.accentContrast,
    fontSize: 13,
    fontWeight: "700",
  },
  accordion: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  accordionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  accordionGlyph: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  accordionBody: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  exerciseChart: {
    gap: spacing.xs,
  },
  exerciseChartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  exerciseChartTitle: {
    color: colors.text,
    fontSize: 12,
    flexShrink: 1,
  },
  exerciseChartLatest: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  streakLegend: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendSwatchOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  exerciseListRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  exerciseListName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  exerciseListDetail: {
    color: colors.textMuted,
    fontSize: 12,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  startButtonText: {
    color: colors.accentContrast,
    fontSize: 14,
    fontWeight: "700",
  },
  stallCallout: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  stallIcon: {
    fontSize: 20,
  },
  stallText: {
    flex: 1,
    gap: spacing.xs,
  },
  stallExercise: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  stallDetail: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

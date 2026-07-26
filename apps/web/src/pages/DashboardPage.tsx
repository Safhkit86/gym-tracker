import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  DashboardStats,
  Exercise,
  ExerciseHistoryPoint,
  Notification,
  SessionDetail,
  SessionExercise,
  StalledExercise,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSummary,
} from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { useUnreadCount } from "../notifications/useUnreadCount";
import { formatSuggestionDelta, toOverride } from "../notifications/suggestion-format";
import { getDashboardStats, getExerciseHistory, getStalledExercise } from "../api/stats";
import { listExercises } from "../api/exercises";
import { getWorkout, listWorkouts } from "../api/workouts";
import { listSessions } from "../api/sessions";
import { listNotifications, markNotificationRead } from "../api/notifications";
import { acceptProgressionDefaults } from "../api/profile";
import { ApiRequestError } from "../api/client";
import { usePager } from "../hooks/usePager";
import { useIsNarrowViewport } from "../hooks/useIsNarrowViewport";
import { PagerControls } from "../components/PagerControls";
import { MiniLineChart } from "../components/MiniLineChart";
import { StreakCalendar } from "../components/StreakCalendar";

const UNSPECIFIED_MUSCLE_GROUP = "Altro";
const MUSCLE_GROUP_CAROUSEL_QUERY = "(max-width: 860px)";

interface MuscleGroupSummary {
  muscleGroup: string;
  setCount: number;
  repCount: number;
}

function groupVolumeByMuscleGroup(
  stats: DashboardStats,
  muscleGroupByExerciseId: Map<string, string>
): MuscleGroupSummary[] {
  const map = new Map<string, MuscleGroupSummary>();
  for (const entry of stats.currentWeekVolumeByExercise) {
    const muscleGroup = muscleGroupByExerciseId.get(entry.exerciseId) ?? UNSPECIFIED_MUSCLE_GROUP;
    const existing = map.get(muscleGroup) ?? { muscleGroup, setCount: 0, repCount: 0 };
    existing.setCount += entry.setCount;
    existing.repCount += entry.repCount;
    map.set(muscleGroup, existing);
  }
  return [...map.values()].sort((a, b) => b.setCount - a.setCount);
}

function formatWorkoutPrescription(exercise: WorkoutExercise): string {
  const setCount = exercise.sets.length;
  const first = exercise.sets[0];
  if (!first) {
    return `${setCount} serie`;
  }
  const reps = first.isMaxEffort
    ? "Max"
    : first.targetMaxReps !== null
      ? `${first.targetMinReps}-${first.targetMaxReps} rip.`
      : `${first.targetMinReps} rip.`;
  const weight = first.targetWeight !== null ? `${first.targetWeight}kg (target)` : "corpo libero";
  return `${setCount} serie · ${reps} · ${weight}`;
}

function formatSessionExerciseSummary(exercise: SessionExercise): string {
  const reps = exercise.sets.map((s) => s.actualReps).join(", ");
  const weight = exercise.sets[0]?.actualWeight;
  const weightLabel = weight !== null && weight !== undefined ? `${weight}kg` : "corpo libero";
  return `${reps} rip. · ${weightLabel}`;
}

export function DashboardPage() {
  const { token } = useAuth();
  const { refreshUnreadCount } = useUnreadCount();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [nextWorkout, setNextWorkout] = useState<WorkoutDetail | null>(null);
  const [lastSession, setLastSession] = useState<SessionDetail | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<Notification[]>([]);
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());
  const [stalledExercise, setStalledExercise] = useState<StalledExercise | null>(null);
  const [exerciseHistories, setExerciseHistories] = useState<Map<string, ExerciseHistoryPoint[]>>(
    new Map()
  );
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
          const lastIndex = last
            ? workoutsResult.findIndex((w: WorkoutSummary) => w.id === last.workoutId)
            : -1;
          const nextSummary = workoutsResult[(lastIndex + 1) % workoutsResult.length];
          const detail = await getWorkout(authToken, nextSummary.id);
          if (!cancelled) {
            setNextWorkout(detail);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError ? err.message : "Impossibile caricare la dashboard."
          );
        }
        return;
      }

      // Sezioni secondarie: un fallimento qui non deve impedire la
      // visualizzazione del resto della pagina (stesso pattern di
      // WorkoutDetailPage per i suggerimenti di progressione).
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
    }

    void load(token);
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Storico per i grafici: solo dopo aver saputo quali sono gli esercizi
  // recenti (dipende da `stats`), in parallelo, non bloccante.
  useEffect(() => {
    if (!token || !stats || stats.recentExercises.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all(
      stats.recentExercises.map((ref) =>
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
  }, [token, stats]);

  const muscleGroupByExerciseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ex of exercises) {
      map.set(ex.id, ex.muscleGroup ?? UNSPECIFIED_MUSCLE_GROUP);
    }
    return map;
  }, [exercises]);

  const muscleGroupVolume = useMemo(
    () => (stats ? groupVolumeByMuscleGroup(stats, muscleGroupByExerciseId) : []),
    [stats, muscleGroupByExerciseId]
  );

  const exercisesByMuscleGroup = useMemo(() => {
    const map = new Map<string, { exerciseId: string; exerciseName: string }[]>();
    if (!stats) {
      return map;
    }
    for (const ref of stats.recentExercises) {
      const muscleGroup = muscleGroupByExerciseId.get(ref.exerciseId) ?? UNSPECIFIED_MUSCLE_GROUP;
      const list = map.get(muscleGroup) ?? [];
      list.push(ref);
      map.set(muscleGroup, list);
    }
    return map;
  }, [stats, muscleGroupByExerciseId]);

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
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile accettare la progressione."
      );
    }
  }

  if (error) {
    return (
      <main className="main-wide-table">
        <p role="alert" className="form-error">
          {error}
        </p>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="main-wide-table">
        <p>Caricamento…</p>
      </main>
    );
  }

  return (
    <main className="main-wide-table">
      <h1>Dashboard</h1>
      <p className="page-subtitle">Bentornato — ecco un riepilogo veloce del tuo allenamento.</p>

      <div className="dashboard-grid">
        <div className="dashboard-col">
          <StatisticheCard stats={stats} muscleGroupVolume={muscleGroupVolume} />
          <SuggerimentiCard
            notifications={pendingSuggestions}
            confirmingIds={confirmingIds}
            onAccept={handleAccept}
          />
          <ProgressioniCard
            exercisesByMuscleGroup={exercisesByMuscleGroup}
            exerciseHistories={exerciseHistories}
          />
          <CostanzaCard streakCalendar={stats.streakCalendar} />
        </div>

        <div className="dashboard-col">
          {nextWorkout && <ProssimaSessioneCard workout={nextWorkout} />}
          {lastSession && <UltimaSessioneCard session={lastSession} />}
          {stalledExercise && <StalloCard stalled={stalledExercise} />}
        </div>
      </div>
    </main>
  );
}

function StatisticheCard({
  stats,
  muscleGroupVolume,
}: {
  stats: DashboardStats;
  muscleGroupVolume: MuscleGroupSummary[];
}) {
  const isNarrow = useIsNarrowViewport(MUSCLE_GROUP_CAROUSEL_QUERY);
  const pageSize = isNarrow ? 1 : 3;
  const pager = usePager(muscleGroupVolume, pageSize);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Statistiche</h2>
      </div>
      <div className="stat-tiles">
        <div>
          <div className="stat-tile__label">Sessioni registrate</div>
          <div className="stat-tile__value">{stats.sessionCount}</div>
        </div>
        <div>
          <div className="stat-tile__label">Settimane consecutive</div>
          <div className="stat-tile__value">{stats.consecutiveWeeks}</div>
        </div>
        <div>
          <div className="stat-tile__label">Kg totali sollevati</div>
          <div className="stat-tile__value">
            {stats.totalKgLifted.toLocaleString("it-IT")}
            <small> kg</small>
          </div>
        </div>
      </div>

      {muscleGroupVolume.length > 0 && (
        <div className="muscle-groups-block">
          <div className="muscle-groups-block__header">
            <h3>Per gruppo muscolare · questa settimana</h3>
            {muscleGroupVolume.length > pageSize && (
              <PagerControls
                start={pager.start}
                pageSize={pageSize}
                total={pager.total}
                canPrev={pager.canPrev}
                canNext={pager.canNext}
                onPrev={pager.prev}
                onNext={pager.next}
                orientation="horizontal"
                prevLabel="Gruppi precedenti"
                nextLabel="Gruppi successivi"
              />
            )}
          </div>
          <div className="muscle-groups">
            {pager.visible.map((mg) => (
              <div className="muscle-group" key={mg.muscleGroup}>
                <h3>{mg.muscleGroup}</h3>
                <div className="row">
                  <span>Serie</span>
                  <strong>{mg.setCount}</strong>
                </div>
                <div className="row">
                  <span>Ripetizioni</span>
                  <strong>{mg.repCount}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SuggerimentiCard({
  notifications,
  confirmingIds,
  onAccept,
}: {
  notifications: Notification[];
  confirmingIds: Set<string>;
  onAccept: (notification: Notification) => void;
}) {
  const pager = usePager(notifications, 2);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Suggerimenti di progressione</h2>
        <div className="card__header-controls">
          {notifications.length > 2 && (
            <PagerControls
              start={pager.start}
              pageSize={2}
              total={pager.total}
              canPrev={pager.canPrev}
              canNext={pager.canNext}
              onPrev={pager.prev}
              onNext={pager.next}
              orientation="vertical"
              prevLabel="Suggerimenti precedenti"
              nextLabel="Suggerimenti successivi"
            />
          )}
          <Link to="/notifications">Vedi tutte →</Link>
        </div>
      </div>
      {notifications.length === 0 ? (
        <p className="suggestion-empty">Nessun suggerimento in sospeso.</p>
      ) : (
        pager.visible.map((notification) => (
          <div className="suggestion-row" key={notification.id}>
            <div className="suggestion-row__text">
              <strong>{notification.exerciseName}</strong>
              <span>{formatSuggestionDelta(notification)}</span>
            </div>
            {confirmingIds.has(notification.id) ? (
              <span className="suggestion-confirm">✓ Accettato</span>
            ) : (
              <button className="btn-accept" type="button" onClick={() => onAccept(notification)}>
                Accetta
              </button>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function ProgressioniCard({
  exercisesByMuscleGroup,
  exerciseHistories,
}: {
  exercisesByMuscleGroup: Map<string, { exerciseId: string; exerciseName: string }[]>;
  exerciseHistories: Map<string, ExerciseHistoryPoint[]>;
}) {
  const muscleGroups = [...exercisesByMuscleGroup.keys()].sort((a, b) => a.localeCompare(b, "it"));

  return (
    <section className="card">
      <div className="card__header">
        <h2>Progressioni per esercizio</h2>
      </div>
      {muscleGroups.length === 0 ? (
        <p className="section-note">Non ci sono ancora abbastanza dati.</p>
      ) : (
        muscleGroups.map((muscleGroup, index) => (
          <details className="muscle-accordion" key={muscleGroup} open={index === 0}>
            <summary>{muscleGroup}</summary>
            <div className="accordion-body">
              {(exercisesByMuscleGroup.get(muscleGroup) ?? []).map((ref) => {
                const points = exerciseHistories.get(ref.exerciseId) ?? [];
                const latest = points[points.length - 1];
                return (
                  <div key={ref.exerciseId}>
                    <div className="exercise-chart__title">
                      <span>
                        {ref.exerciseName} — {latest?.unit === "reps" ? "ripetizioni" : "peso (kg)"}
                      </span>
                      {latest && (
                        <span className="latest">
                          {latest.unit === "kg" ? `${latest.value}kg` : `${latest.value} rip.`}
                        </span>
                      )}
                    </div>
                    <MiniLineChart points={points} />
                  </div>
                );
              })}
            </div>
          </details>
        ))
      )}
    </section>
  );
}

function CostanzaCard({ streakCalendar }: { streakCalendar: string[] }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>Costanza recente</h2>
      </div>
      <StreakCalendar trainedDates={streakCalendar} />
      <div className="streak-legend">
        <span className="streak-legend__swatch streak-legend__swatch--on"></span> Sessione
        registrata
        <span
          className="streak-legend__swatch"
          style={{ marginLeft: "var(--space-3)" }}
        ></span>{" "}
        Giorno di riposo
      </div>
      <p className="section-note">Ultime 5 settimane, un riquadro per giorno.</p>
    </section>
  );
}

function PaginatedExerciseList<T>({
  items,
  pageSize,
  renderItem,
  keyFor,
}: {
  items: T[];
  pageSize: number;
  renderItem: (item: T) => ReactNode;
  keyFor: (item: T) => string;
}) {
  const pager = usePager(items, pageSize);
  return (
    <>
      <ul className="session-exercise-list">
        {pager.visible.map((item) => (
          <li key={keyFor(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {items.length > pageSize && (
        <PagerControls
          start={pager.start}
          pageSize={pageSize}
          total={pager.total}
          canPrev={pager.canPrev}
          canNext={pager.canNext}
          onPrev={pager.prev}
          onNext={pager.next}
          orientation="vertical"
          prevLabel="Esercizi precedenti"
          nextLabel="Esercizi successivi"
        />
      )}
    </>
  );
}

function ProssimaSessioneCard({ workout }: { workout: WorkoutDetail }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>Prossima sessione</h2>
      </div>
      <p className="page-subtitle" style={{ margin: "calc(-1 * var(--space-2)) 0 var(--space-3)" }}>
        {workout.name}
      </p>
      <PaginatedExerciseList
        items={workout.exercises}
        pageSize={3}
        keyFor={(exercise) => exercise.id}
        renderItem={(exercise) => (
          <>
            <span className="ex-name">{exercise.exerciseName}</span>
            <span className="ex-detail">{formatWorkoutPrescription(exercise)}</span>
          </>
        )}
      />
      <Link to={`/workouts/${workout.id}/log`} className="btn-start">
        Avvia sessione
      </Link>
    </section>
  );
}

function UltimaSessioneCard({ session }: { session: SessionDetail }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>Ultima sessione</h2>
      </div>
      <p className="page-subtitle" style={{ margin: "calc(-1 * var(--space-2)) 0 var(--space-3)" }}>
        {session.workoutName} · {new Date(session.performedAt).toLocaleDateString("it-IT")}
      </p>
      <PaginatedExerciseList
        items={session.exercises}
        pageSize={3}
        keyFor={(exercise) => exercise.exerciseId}
        renderItem={(exercise) => (
          <>
            <span className="ex-name">{exercise.exerciseName}</span>
            <span className="ex-detail">{formatSessionExerciseSummary(exercise)}</span>
          </>
        )}
      />
    </section>
  );
}

function StalloCard({ stalled }: { stalled: StalledExercise }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>Esercizio in stallo</h2>
      </div>
      <div className="stall-callout">
        <span className="stall-callout__icon">⏸</span>
        <div>
          <strong>{stalled.exerciseName}</strong>
          <span>
            Nessuna progressione da {Math.floor(stalled.daysSinceLastProgression / 7)} settimane —
            potrebbe essere il momento di alzare l&apos;asticella manualmente.
          </span>
        </div>
      </div>
    </section>
  );
}

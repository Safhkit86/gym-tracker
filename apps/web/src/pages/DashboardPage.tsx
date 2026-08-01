import { useEffect, useMemo, useState } from "react";
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
import { PagerControls } from "../components/PagerControls";
import { MiniLineChart } from "../components/MiniLineChart";
import { StreakCalendar } from "../components/StreakCalendar";
import { StatisticheCard } from "../components/StatisticheCard";
import {
  UNSPECIFIED_MUSCLE_GROUP,
  normalizeMuscleGroup,
  groupVolumeByMuscleGroup,
  sortExerciseGroups,
  type ExerciseRef,
} from "../utils/muscle-groups";

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
  /** Esercizi che compaiono in almeno una scheda attuale (unione su tutte le
   *  schede): "Progressioni per esercizio" mostra solo questi, non lo
   *  storico di esercizi rimossi dalle schede/di schede passate. Stesso
   *  criterio in StatisticsPage. */
  const [currentSchedeExercises, setCurrentSchedeExercises] = useState<ExerciseRef[]>([]);
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
          setNextWorkout(workoutDetails[nextIndex]);

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
  exercisesByMuscleGroup: Map<string, ExerciseRef[]>;
  exerciseHistories: Map<string, ExerciseHistoryPoint[]>;
}) {
  const sortedGroups = sortExerciseGroups(exercisesByMuscleGroup, exerciseHistories);
  // Solo un accordion aperto alla volta, altrimenti la card cresce troppo
  // con molti gruppi muscolari. null = nessuna scelta esplicita ancora,
  // apri il primo gruppo di default.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const effectiveOpenGroup = openGroup ?? sortedGroups[0]?.[0] ?? null;

  return (
    <section className="card">
      <div className="card__header">
        <h2>Progressioni per esercizio</h2>
      </div>
      {sortedGroups.length === 0 ? (
        <p className="section-note">Non ci sono ancora abbastanza dati.</p>
      ) : (
        sortedGroups.map(([muscleGroup, exercisesInGroup]) => (
          <details
            className="muscle-accordion"
            key={muscleGroup}
            open={effectiveOpenGroup === muscleGroup}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                setOpenGroup(effectiveOpenGroup === muscleGroup ? null : muscleGroup);
              }}
            >
              {muscleGroup}
            </summary>
            <div className="accordion-body">
              {exercisesInGroup.map((ref) => {
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
                    <MiniLineChart
                      points={points.map((p) => ({
                        id: p.sessionId,
                        date: p.performedAt,
                        value: p.value,
                      }))}
                      unit={latest?.unit ?? "kg"}
                      emptyMessage="Nessuno storico disponibile per questo esercizio."
                    />
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

function ProssimaSessioneCard({ workout }: { workout: WorkoutDetail }) {
  const pager = usePager(workout.exercises, 3);
  return (
    <section className="card">
      <div className="card__header">
        <h2>Prossima sessione</h2>
        {workout.exercises.length > 3 && (
          <PagerControls
            start={pager.start}
            pageSize={3}
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
      </div>
      <p className="page-subtitle" style={{ margin: "calc(-1 * var(--space-2)) 0 var(--space-3)" }}>
        {workout.name}
      </p>
      <ul className="session-exercise-list">
        {pager.visible.map((exercise) => (
          <li key={exercise.id}>
            <span className="ex-name">{exercise.exerciseName}</span>
            <span className="ex-detail">{formatWorkoutPrescription(exercise)}</span>
          </li>
        ))}
      </ul>
      <Link to={`/workouts/${workout.id}/log`} className="btn-start">
        Avvia sessione
      </Link>
    </section>
  );
}

function UltimaSessioneCard({ session }: { session: SessionDetail }) {
  const pager = usePager(session.exercises, 3);
  return (
    <section className="card">
      <div className="card__header">
        <h2>Ultima sessione</h2>
        {session.exercises.length > 3 && (
          <PagerControls
            start={pager.start}
            pageSize={3}
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
      </div>
      <p className="page-subtitle" style={{ margin: "calc(-1 * var(--space-2)) 0 var(--space-3)" }}>
        {session.workoutName} · {new Date(session.performedAt).toLocaleDateString("it-IT")}
      </p>
      <ul className="session-exercise-list">
        {pager.visible.map((exercise) => (
          <li key={exercise.exerciseId}>
            <span className="ex-name">{exercise.exerciseName}</span>
            <span className="ex-detail">{formatSessionExerciseSummary(exercise)}</span>
          </li>
        ))}
      </ul>
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

import { useEffect, useMemo, useState } from "react";
import type {
  DashboardStats,
  Exercise,
  ExerciseHistoryPoint,
  MeasurementEntry,
} from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { getDashboardStats, getExerciseHistory } from "../api/stats";
import { listExercises } from "../api/exercises";
import { getWorkout, listWorkouts } from "../api/workouts";
import { listMeasurements } from "../api/measurements";
import { ApiRequestError } from "../api/client";
import { StatisticheCard } from "../components/StatisticheCard";
import { MiniLineChart } from "../components/MiniLineChart";
import {
  UNSPECIFIED_MUSCLE_GROUP,
  normalizeMuscleGroup,
  groupVolumeByMuscleGroup,
  sortExerciseGroups,
  type ExerciseRef,
} from "../utils/muscle-groups";

type StatisticsTab = "sessions" | "measurements";

const MEASUREMENT_FIELDS = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "chestCm", label: "Petto", unit: "cm" },
  { key: "armCm", label: "Braccia", unit: "cm" },
  { key: "waistCm", label: "Vita", unit: "cm" },
  { key: "legCm", label: "Gamba", unit: "cm" },
] as const;

export function StatisticsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  /** Solo gli esercizi che compaiono in almeno una scheda attuale, stesso
   *  criterio della Dashboard: niente storico di esercizi rimossi dalle
   *  schede o di schede passate. */
  const [currentSchedeExercises, setCurrentSchedeExercises] = useState<ExerciseRef[]>([]);
  const [exerciseHistories, setExerciseHistories] = useState<Map<string, ExerciseHistoryPoint[]>>(
    new Map()
  );
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<StatisticsTab>("sessions");
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
          setError(
            err instanceof ApiRequestError ? err.message : "Impossibile caricare le statistiche."
          );
        }
      }
    }

    void load(token);
    return () => {
      cancelled = true;
    };
  }, [token]);

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

  // Caricamento lazy: solo quando l'utente apre la vista Misure, stesso
  // pattern dello Storico.
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
            err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova."
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
      <h1>Statistiche</h1>
      <p className="page-subtitle">
        Il tuo andamento nel tempo, per esercizio e per misura corporea.
      </p>

      <StatisticheCard stats={stats} muscleGroupVolume={muscleGroupVolume} />

      <div className="toolbar">
        <button
          type="button"
          className={tab === "sessions" ? undefined : "secondary"}
          onClick={() => setTab("sessions")}
        >
          Sessioni di allenamento
        </button>
        <button
          type="button"
          className={tab === "measurements" ? undefined : "secondary"}
          onClick={() => setTab("measurements")}
        >
          Misure
        </button>
      </div>

      {tab === "sessions" && (
        <>
          {sortedGroups.length === 0 ? (
            <p className="section-note">Non ci sono ancora abbastanza dati.</p>
          ) : (
            sortedGroups.map(([muscleGroup, exercisesInGroup]) => (
              <section className="stat-group" key={muscleGroup}>
                <h2 className="stat-group__header">{muscleGroup}</h2>
                <div className="stat-group__body">
                  {exercisesInGroup.map((ref) => {
                    const points = exerciseHistories.get(ref.exerciseId) ?? [];
                    const latest = points[points.length - 1];
                    return (
                      <div key={ref.exerciseId}>
                        <div className="exercise-chart__title">
                          <span>
                            {ref.exerciseName} —{" "}
                            {latest?.unit === "reps" ? "ripetizioni" : "peso (kg)"}
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
              </section>
            ))
          )}
        </>
      )}

      {tab === "measurements" && (
        <section className="card">
          {measurementsError && (
            <p role="alert" className="form-error">
              {measurementsError}
            </p>
          )}
          {measurements === null && !measurementsError && <p>Caricamento…</p>}
          {measurements?.length === 0 && <p>Non hai ancora registrato nessuna misurazione.</p>}

          {measurements && measurements.length > 0 && (
            <div className="measure-grid">
              {MEASUREMENT_FIELDS.map(({ key, label, unit }) => {
                const points = measurementsChronological
                  .filter((entry) => entry[key] !== null)
                  .map((entry) => ({
                    id: entry.id,
                    date: entry.measuredOn,
                    value: entry[key] as number,
                  }));
                return (
                  <div key={key}>
                    <div className="exercise-chart__title">
                      <span>
                        {label} — {unit}
                      </span>
                      {points.length > 0 && (
                        <span className="latest">
                          {points[points.length - 1].value}
                          {unit}
                        </span>
                      )}
                    </div>
                    <MiniLineChart
                      points={points}
                      unit={unit}
                      emptyMessage={`Nessuna misurazione di ${label.toLowerCase()} registrata.`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

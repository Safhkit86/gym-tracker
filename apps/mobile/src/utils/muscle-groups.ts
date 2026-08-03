import type { DashboardStats, ExerciseHistoryPoint } from "@gym-tracker/shared";

export const UNSPECIFIED_MUSCLE_GROUP = "Altro";

export interface MuscleGroupSummary {
  muscleGroup: string;
  setCount: number;
  repCount: number;
}

export interface ExerciseRef {
  exerciseId: string;
  exerciseName: string;
}

/** Stessa logica di apps/web/src/utils/muscle-groups.ts: i polpacci sono un
 *  sotto-gruppo di Gambe nel catalogo esercizi, ma vanno mostrati insieme,
 *  non come gruppo a parte. */
export function normalizeMuscleGroup(muscleGroup: string): string {
  return muscleGroup === "Polpacci" ? "Gambe" : muscleGroup;
}

export function groupVolumeByMuscleGroup(
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

/** Gruppi muscolari in ordine alfabetico, con dentro gli esercizi ordinati
 *  per miglior risultato storico raggiunto (il piu' alto in cima) — stesso
 *  ordinamento usato dall'accordion "Progressioni per esercizio". */
export function sortExerciseGroups(
  exercisesByMuscleGroup: Map<string, ExerciseRef[]>,
  exerciseHistories: Map<string, ExerciseHistoryPoint[]>
): Array<[string, ExerciseRef[]]> {
  function maxValueFor(exerciseId: string): number {
    const points = exerciseHistories.get(exerciseId);
    return points && points.length > 0 ? Math.max(...points.map((p) => p.value)) : -Infinity;
  }

  return [...exercisesByMuscleGroup.keys()]
    .sort((a, b) => a.localeCompare(b, "it"))
    .map((muscleGroup) => {
      const exercisesInGroup = [...(exercisesByMuscleGroup.get(muscleGroup) ?? [])].sort(
        (a, b) => maxValueFor(b.exerciseId) - maxValueFor(a.exerciseId)
      );
      return [muscleGroup, exercisesInGroup] as [string, ExerciseRef[]];
    });
}

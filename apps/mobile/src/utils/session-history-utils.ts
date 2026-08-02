import type { SessionDetail } from "@gym-tracker/shared";

/** Peso mostrato per l'esercizio: quello del primo set, assumendo (come nel
 *  caso tipico di set dritti) lo stesso carico su tutti i set della riga.
 *  Stesso comportamento di apps/web/src/pages/SessionHistoryPage.tsx. */
export function formatWeight(
  exercise: SessionDetail["exercises"][number],
  bodyweightLabel: string
): string {
  const weight = exercise.sets[0]?.actualWeight ?? null;
  return weight !== null ? `${weight} kg` : bodyweightLabel;
}

/** Recupero prima di passare all'esercizio successivo (prescritto dalla
 *  scheda al momento del log). */
export function formatRestSeconds(exercise: SessionDetail["exercises"][number]): string {
  return exercise.restSeconds !== null ? `${exercise.restSeconds}s` : "—";
}

/** Numero di settimana per sessione, indipendente dall'ordinamento mostrato:
 *  scorre le sessioni in ordine cronologico e incrementa ogni volta che
 *  ricomincia dalla scheda "1 - ...", cosi' il conteggio resta corretto sia
 *  in ordine crescente che decrescente. Stessa euristica di
 *  apps/web/src/pages/SessionHistoryPage.tsx (computeWeekNumbers). */
export function computeWeekNumbers(sessions: SessionDetail[]): Map<string, number> {
  const chronological = [...sessions].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  const weekBySessionId = new Map<string, number>();
  let week = 0;
  for (const session of chronological) {
    if (week === 0 || /^1\s*-/.test(session.workoutName)) {
      week++;
    }
    weekBySessionId.set(session.id, week);
  }
  return weekBySessionId;
}

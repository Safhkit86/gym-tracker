import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import type { ProgressionEvent, SessionDetail } from "@gym-tracker/shared";
import { InMemoryStatsRepository } from "../src/repositories/stats-repository.js";
import type { SessionRepository } from "../src/repositories/session-repository.js";
import type { ProgressionEventRepository } from "../src/repositories/progression-event-repository.js";

const OWNER = "11111111-1111-1111-1111-111111111111";

/** "now" fisso (mercoledi'): lunedi' della settimana = 2026-07-13,
 *  settimana scorsa = 2026-07-06, due settimane fa = 2026-06-29. Fisso cosi'
 *  i test sono deterministici a prescindere da quando girano. */
const NOW = new Date("2026-07-15T12:00:00.000Z");

function session(overrides: {
  performedAt: string;
  exerciseId: string;
  exerciseName: string;
  actualWeight: number | null;
  actualReps: number;
  setCount?: number;
}): SessionDetail {
  const setCount = overrides.setCount ?? 1;
  return {
    id: randomUUID(),
    workoutId: "workout-1",
    workoutName: "Test",
    workoutNotes: null,
    performedAt: overrides.performedAt,
    notes: null,
    createdAt: overrides.performedAt,
    exercises: [
      {
        exerciseId: overrides.exerciseId,
        exerciseName: overrides.exerciseName,
        workoutExerciseId: null,
        progressionIncrement: null,
        restSeconds: null,
        sets: Array.from({ length: setCount }, (_, i) => ({
          id: randomUUID(),
          setNumber: i + 1,
          targetMinReps: null,
          targetMaxReps: null,
          actualReps: overrides.actualReps,
          actualWeight: overrides.actualWeight,
          actualRpe: null,
          targetRestMinSeconds: null,
          targetRestMaxSeconds: null,
          actualRestSeconds: null,
        })),
      },
    ],
  };
}

function event(overrides: {
  exerciseId: string;
  exerciseName: string;
  createdAt: string;
}): ProgressionEvent {
  return {
    id: randomUUID(),
    exerciseId: overrides.exerciseId,
    exerciseName: overrides.exerciseName,
    triggeringSessionId: randomUUID(),
    suggestionType: "increase_weight",
    previousValue: 10,
    suggestedValue: 12,
    reason: "test",
    source: "rule",
    createdAt: overrides.createdAt,
  };
}

/** Stub minimo: solo listByOwner conta per InMemoryStatsRepository, il resto
 *  dell'interfaccia non viene mai chiamato in questi test. */
function fakeSessions(sessions: SessionDetail[]): SessionRepository {
  return {
    create: () => Promise.reject(new Error("not implemented")),
    listByOwner: () => Promise.resolve(sessions),
    findDetail: () => Promise.reject(new Error("not implemented")),
    delete: () => Promise.reject(new Error("not implemented")),
    findRecentSetsForExercise: () => Promise.reject(new Error("not implemented")),
    findExerciseHistory: () => Promise.reject(new Error("not implemented")),
  };
}

function fakeEvents(events: ProgressionEvent[]): ProgressionEventRepository {
  return {
    create: () => Promise.reject(new Error("not implemented")),
    listByOwner: () => Promise.resolve(events),
  };
}

function buildRepo(
  sessions: SessionDetail[],
  events: ProgressionEvent[] = []
): InMemoryStatsRepository {
  return new InMemoryStatsRepository(fakeSessions(sessions), fakeEvents(events));
}

describe("StatsRepository.getStats", () => {
  it("torna tutto a zero/vuoto senza sessioni", async () => {
    const repo = buildRepo([]);
    const stats = await repo.getStats(OWNER, NOW);
    expect(stats).toEqual({
      sessionCount: 0,
      consecutiveWeeks: 0,
      totalKgLifted: 0,
      currentWeekVolumeByExercise: [],
      recentExercises: [],
      streakCalendar: [],
    });
  });

  it("i set a corpo libero (peso nullo) contano 0 nel totale kg", async () => {
    const repo = buildRepo([
      session({
        performedAt: "2026-07-15T09:00:00.000Z",
        exerciseId: "dip",
        exerciseName: "Dip",
        actualWeight: null,
        actualReps: 10,
      }),
      session({
        performedAt: "2026-07-15T09:30:00.000Z",
        exerciseId: "panca",
        exerciseName: "Panca piana",
        actualWeight: 80,
        actualReps: 10,
      }),
    ]);
    const stats = await repo.getStats(OWNER, NOW);
    expect(stats.totalKgLifted).toBe(800);
    expect(stats.sessionCount).toBe(2);
  });

  it("il volume settimanale considera solo le sessioni della settimana corrente (Lun-Dom)", async () => {
    const repo = buildRepo([
      session({
        performedAt: "2026-07-13T09:00:00.000Z", // lunedi' di questa settimana
        exerciseId: "panca",
        exerciseName: "Panca piana",
        actualWeight: 80,
        actualReps: 10,
      }),
      session({
        performedAt: "2026-07-15T09:00:00.000Z", // mercoledi' di questa settimana
        exerciseId: "panca",
        exerciseName: "Panca piana",
        actualWeight: 80,
        actualReps: 10,
      }),
      session({
        performedAt: "2026-07-08T09:00:00.000Z", // settimana scorsa: esclusa
        exerciseId: "panca",
        exerciseName: "Panca piana",
        actualWeight: 80,
        actualReps: 10,
      }),
    ]);
    const stats = await repo.getStats(OWNER, NOW);
    expect(stats.currentWeekVolumeByExercise).toEqual([
      { exerciseId: "panca", exerciseName: "Panca piana", setCount: 2, repCount: 20 },
    ]);
  });

  it("settimane consecutive: conta a ritroso e si interrompe al primo buco", async () => {
    const repoTre = buildRepo([
      session({
        performedAt: "2026-07-15T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-07-08T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-07-01T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect((await repoTre.getStats(OWNER, NOW)).consecutiveWeeks).toBe(3);

    const repoConBuco = buildRepo([
      session({
        performedAt: "2026-07-15T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
      // 07-08 (settimana scorsa) mancante: la serie si interrompe subito.
      session({
        performedAt: "2026-07-01T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect((await repoConBuco.getStats(OWNER, NOW)).consecutiveWeeks).toBe(1);
  });

  it("la settimana corrente senza sessioni (ancora in corso) non interrompe la serie", async () => {
    const repo = buildRepo([
      session({
        performedAt: "2026-07-08T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-07-01T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect((await repo.getStats(OWNER, NOW)).consecutiveWeeks).toBe(2);
  });

  it("il calendario di costanza include solo gli ultimi 35 giorni, ordinato", async () => {
    const repo = buildRepo([
      session({
        performedAt: "2026-07-08T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-07-15T09:00:00.000Z",
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-05-01T09:00:00.000Z", // oltre 35gg prima di NOW: escluso
        exerciseId: "e",
        exerciseName: "E",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect((await repo.getStats(OWNER, NOW)).streakCalendar).toEqual(["2026-07-08", "2026-07-15"]);
  });

  it("gli esercizi recenti sono ordinati per data piu' recente ed escludono quelli oltre 35gg", async () => {
    const repo = buildRepo([
      session({
        performedAt: "2026-07-14T09:00:00.000Z",
        exerciseId: "vecchio-recente",
        exerciseName: "Vecchio recente",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-07-15T09:00:00.000Z",
        exerciseId: "nuovo",
        exerciseName: "Nuovo",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: "2026-05-01T09:00:00.000Z",
        exerciseId: "troppo-vecchio",
        exerciseName: "Troppo vecchio",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect((await repo.getStats(OWNER, NOW)).recentExercises).toEqual([
      { exerciseId: "nuovo", exerciseName: "Nuovo" },
      { exerciseId: "vecchio-recente", exerciseName: "Vecchio recente" },
    ]);
  });
});

describe("StatsRepository.getStalledExercise", () => {
  it("torna null senza alcuna sessione", async () => {
    const repo = buildRepo([]);
    expect(await repo.getStalledExercise(OWNER, NOW)).toBeNull();
  });

  it("torna null se il gap e' sotto soglia (21 giorni)", async () => {
    const repo = buildRepo([
      session({
        performedAt: NOW.toISOString(),
        exerciseId: "x",
        exerciseName: "X",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect(await repo.getStalledExercise(OWNER, NOW)).toBeNull();
  });

  it("segnala un esercizio mai progredito usando il primo log come ancora", async () => {
    const fortyDaysAgo = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const repo = buildRepo([
      session({
        performedAt: fortyDaysAgo,
        exerciseId: "y",
        exerciseName: "Y",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    const result = await repo.getStalledExercise(OWNER, NOW);
    expect(result).toMatchObject({ exerciseId: "y", exerciseName: "Y" });
    expect(result?.daysSinceLastProgression).toBe(40);
  });

  it("usa l'ultima progressione (non il primo log) come ancora quando esiste", async () => {
    const ninetyDaysAgo = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const repo = buildRepo(
      [
        session({
          performedAt: ninetyDaysAgo,
          exerciseId: "z",
          exerciseName: "Z",
          actualWeight: 10,
          actualReps: 5,
        }),
      ],
      [event({ exerciseId: "z", exerciseName: "Z", createdAt: fiveDaysAgo })]
    );
    // Gap dall'ultima progressione (5gg) sotto soglia: non segnalato, anche
    // se il primo log risale a 90 giorni fa.
    expect(await repo.getStalledExercise(OWNER, NOW)).toBeNull();
  });

  it("sceglie l'esercizio col gap maggiore tra piu' candidati", async () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const repo = buildRepo([
      session({
        performedAt: thirtyDaysAgo,
        exerciseId: "meno-stallo",
        exerciseName: "Meno in stallo",
        actualWeight: 10,
        actualReps: 5,
      }),
      session({
        performedAt: sixtyDaysAgo,
        exerciseId: "piu-stallo",
        exerciseName: "Piu' in stallo",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    const result = await repo.getStalledExercise(OWNER, NOW);
    expect(result?.exerciseId).toBe("piu-stallo");
  });

  it("la soglia e' inclusiva: esattamente 21 giorni viene segnalato, 20 no", async () => {
    const exactly21 = new Date(NOW.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const repoAtThreshold = buildRepo([
      session({
        performedAt: exactly21,
        exerciseId: "soglia",
        exerciseName: "Soglia",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect(await repoAtThreshold.getStalledExercise(OWNER, NOW)).toMatchObject({
      exerciseId: "soglia",
    });

    const twenty = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const repoSotto = buildRepo([
      session({
        performedAt: twenty,
        exerciseId: "sotto-soglia",
        exerciseName: "Sotto soglia",
        actualWeight: 10,
        actualReps: 5,
      }),
    ]);
    expect(await repoSotto.getStalledExercise(OWNER, NOW)).toBeNull();
  });
});

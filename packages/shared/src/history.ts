/**
 * Contratti di history-service: storico delle sessioni eseguite (esecuzione
 * reale contro la prescrizione di workout-service) e statistiche derivate.
 * Il client possiede gia' tutti i dati della scheda quando registra una
 * sessione (li ha appena caricati per mostrarla), quindi invia uno snapshot
 * autosufficiente: history-service non chiama mai workout-service via HTTP.
 */

// --- Input (body di POST /sessions) ---

export interface SessionSetInput {
  setNumber: number;
  /** Snapshot della prescrizione al momento del log; null per log liberi. */
  targetMinReps?: number | null;
  /** Snapshot della prescrizione al momento del log; null se non era un range. */
  targetMaxReps?: number | null;
  actualReps: number;
  /** kg; null = a corpo libero. */
  actualWeight?: number | null;
  /** Percezione dello sforzo 1-10; null se non registrata. */
  actualRpe?: number | null;
  /** Snapshot di WorkoutSet.restMinSeconds (recupero tra questo set e il
   *  successivo dello stesso esercizio) al momento del log. */
  targetRestMinSeconds?: number | null;
  /** Snapshot di WorkoutSet.restMaxSeconds al momento del log. */
  targetRestMaxSeconds?: number | null;
  /** Recupero tra i set effettivamente preso. */
  actualRestSeconds?: number | null;
}

export interface SessionExerciseInput {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId?: string | null;
  /** Snapshot di WorkoutExercise.progressionIncrement al momento del log. */
  progressionIncrement?: number | null;
  /** Snapshot di WorkoutExercise.restSeconds (recupero prima di passare
   *  all'esercizio successivo — concetto diverso dal recupero tra i set,
   *  che vive sul singolo set) al momento del log. */
  restSeconds?: number | null;
  sets: SessionSetInput[];
}

export interface SessionInput {
  workoutId: string;
  workoutName: string;
  /** Snapshot di Workout.notes al momento del log (non le note della sessione). */
  workoutNotes?: string | null;
  performedAt: string;
  notes?: string | null;
  exercises: SessionExerciseInput[];
}

// --- Output ---

export interface SessionSet {
  id: string;
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  actualReps: number;
  actualWeight: number | null;
  actualRpe: number | null;
  /** Snapshot di WorkoutSet.restMinSeconds al momento del log. */
  targetRestMinSeconds: number | null;
  /** Snapshot di WorkoutSet.restMaxSeconds al momento del log. */
  targetRestMaxSeconds: number | null;
  /** Recupero tra i set effettivamente preso. */
  actualRestSeconds: number | null;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string | null;
  progressionIncrement: number | null;
  /** Snapshot di WorkoutExercise.restSeconds (recupero prima dell'esercizio
   *  successivo) al momento del log. */
  restSeconds: number | null;
  sets: SessionSet[];
}

/** Vista completa: sessione con esercizi e set eseguiti. */
export interface SessionDetail {
  id: string;
  workoutId: string;
  workoutName: string;
  /** Snapshot di Workout.notes al momento del log (non le note della sessione). */
  workoutNotes: string | null;
  performedAt: string;
  notes: string | null;
  exercises: SessionExercise[];
  createdAt: string;
}

// --- Statistiche per la Dashboard (GET /stats, GET /sessions/exercise-history) ---

/** Volume di un esercizio nella settimana corrente. Il raggruppamento per
 *  muscleGroup avviene lato client (history-service non conosce il
 *  catalogo esercizi di workout-service). */
export interface MuscleGroupVolumeEntry {
  exerciseId: string;
  exerciseName: string;
  setCount: number;
  repCount: number;
}

/** Esercizio loggato di recente, candidato per il grafico "Progressioni per
 *  esercizio" della Dashboard. */
export interface RecentExerciseRef {
  exerciseId: string;
  exerciseName: string;
}

export interface DashboardStats {
  sessionCount: number;
  /** Settimane consecutive (Lun-Dom) con almeno una sessione, contate a
   *  ritroso dalla settimana corrente (che non deve necessariamente averne
   *  gia' una: e' ancora in corso). */
  consecutiveWeeks: number;
  /** Somma di peso*ripetizioni su tutti i set mai registrati; i set a corpo
   *  libero (peso nullo) contano 0. */
  totalKgLifted: number;
  /** Volume per esercizio nella settimana corrente (Lun-Dom). */
  currentWeekVolumeByExercise: MuscleGroupVolumeEntry[];
  /** Esercizi loggati negli ultimi 35 giorni, piu' recenti prima, max 20:
   *  il set su cui la Dashboard richiede lo storico per i grafici. */
  recentExercises: RecentExerciseRef[];
  /** Date (YYYY-MM-DD) con almeno una sessione, ultimi 35 giorni. */
  streakCalendar: string[];
}

/** Un punto del grafico "Progressioni per esercizio": il valore e' il peso
 *  massimo del set in quella sessione se l'esercizio prevede pesi,
 *  altrimenti le ripetizioni massime. */
export interface ExerciseHistoryPoint {
  sessionId: string;
  performedAt: string;
  value: number;
  unit: "kg" | "reps";
}

// --- Eventi RabbitMQ (history-service -> progress-service) ---

/** Un set eseguito, cosi' come lo consuma il motore di regole (senza il nome
 *  esercizio: gia' noto al chiamante). */
export interface HistoricalSetPayload {
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  actualReps: number;
  actualWeight: number | null;
}

export interface SessionLoggedExercisePayload {
  exerciseId: string;
  exerciseName: string;
  progressionIncrement: number | null;
  sets: HistoricalSetPayload[];
}

/**
 * Pubblicato da history-service dopo aver salvato una sessione. Consumato da
 * progress-service per aggiornare `exercise_history_cache` e valutare il
 * motore di regole in modo asincrono (invece che nella stessa richiesta HTTP
 * di POST /sessions, oggi che le due responsabilita' sono in servizi
 * diversi). `workoutId` e' a livello di sessione (una sessione registra
 * sempre una sola scheda): serve alla cache per il filtro di scope
 * workout/exercise, vedi ExerciseHistoryCacheRepository in progress-service.
 */
export interface SessionLoggedEvent {
  sessionId: string;
  userId: string;
  workoutId: string;
  performedAt: string;
  exercises: SessionLoggedExercisePayload[];
}

/** Pubblicato da history-service dopo aver cancellato una sessione.
 *  Sostituisce l'FK reale `progression_events.triggering_session_id ->
 *  workout_sessions.id ON DELETE CASCADE` di quando le due tabelle vivevano
 *  nello stesso servizio: progress-service cancella lui stesso le righe
 *  `progression_events` collegate. `exerciseIds` (gli esercizi che erano
 *  nella sessione cancellata) serve a progress-service per rimuovere anche
 *  la entry corrispondente da `exercise_history_cache.recent_outcomes`:
 *  senza saperlo, la finestra scorrevole terrebbe una sessione cancellata
 *  finche' non esce naturalmente dalla finestra, potendo influenzare
 *  valutazioni future del motore di regole. */
export interface SessionDeletedEvent {
  sessionId: string;
  userId: string;
  exerciseIds: string[];
}

export const SESSION_LOGGED_QUEUE = "session-logged";
export const SESSION_DELETED_QUEUE = "session-deleted";

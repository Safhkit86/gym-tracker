/**
 * Contratti di workout-service: schede (workout), esercizi del catalogo e la
 * prescrizione a 3 livelli Workout -> WorkoutExercise -> WorkoutSet.
 * Modellano la SCHEDA (cosa fare); l'esecuzione reale sara' di progress-service.
 */

/** Esercizio del catalogo. `userId` null = esercizio globale (seed). */
export interface Exercise {
  id: string;
  userId: string | null;
  name: string;
  muscleGroup: string | null;
  /** Come eseguire l'esercizio; null se non disponibile (es. esercizi personali). */
  description: string | null;
  /** Link a una pagina sorgente (non media incorporati); null se non disponibile. */
  sourceUrl: string | null;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup?: string | null;
}

// --- Input (body di POST/PUT /workouts) ---

export interface WorkoutSetInput {
  setNumber: number;
  /** Obbligatorio a meno che isMaxEffort sia true (sforzo massimo/AMRAP,
   *  nessun obiettivo numerico). */
  targetMinReps?: number | null;
  /** Se assente/null, l'obiettivo e' il singolo valore targetMinReps (nessun range). */
  targetMaxReps?: number | null;
  /** kg; null = a corpo libero */
  targetWeight?: number | null;
  /** Recupero tra una serie e l'altra; null/assente = non specificato. */
  restMinSeconds?: number | null;
  /** Se assente/null e restMinSeconds e' impostato, il recupero e' il singolo
   *  valore restMinSeconds (nessun range). Richiede restMinSeconds. */
  restMaxSeconds?: number | null;
  /** true = l'obiettivo e' "il piu' possibile" (AMRAP), non un numero fisso:
   *  in quel caso targetMinReps/targetMaxReps vanno lasciati assenti/null.
   *  Assente/false = comportamento invariato (obiettivo numerico). */
  isMaxEffort?: boolean;
}

export interface WorkoutExerciseInput {
  exerciseId: string;
  position: number;
  notes?: string | null;
  /** Recupero dopo questo esercizio, prima del successivo (secondi). */
  restSeconds?: number | null;
  /**
   * Incremento da applicare quando progress-service rileva che e' il momento
   * di progredire su questo esercizio (kg se pesato, ripetizioni a corpo
   * libero): scelto da chi crea la scheda, non un valore fisso uguale per
   * tutti gli esercizi. null/assente = progressione non configurata (il
   * motore di progress-service non propone nulla per questo esercizio).
   */
  progressionIncrement?: number | null;
  sets: WorkoutSetInput[];
}

export interface WorkoutInput {
  name: string;
  notes?: string | null;
  /** Allenamento (gruppo di schede) a cui assegnare/spostare questa scheda.
   *  Assente/null = resta/entra nell'allenamento attivo dell'utente (vedi
   *  AllenamentoService.resolveAllenamentoId in workout-service): permette
   *  di spostare una scheda passando un id diverso su PUT /workouts/:id
   *  senza dover esporre una rotta dedicata solo per questo. */
  allenamentoId?: string | null;
  exercises: WorkoutExerciseInput[];
}

/** Body di PUT /workouts/reorder: id delle schede dell'utente nel nuovo ordine. */
export interface ReorderWorkoutsRequest {
  workoutIds: string[];
}

// --- Output ---

export interface WorkoutSet {
  id: string;
  setNumber: number;
  /** null quando isMaxEffort e' true: uno sforzo massimo (AMRAP) non ha un
   *  obiettivo numerico di ripetizioni. */
  targetMinReps: number | null;
  /** null = nessun range: l'obiettivo e' il singolo valore targetMinReps. */
  targetMaxReps: number | null;
  targetWeight: number | null;
  /** null = recupero non specificato. */
  restMinSeconds: number | null;
  /** null = nessun range: il recupero e' il singolo valore restMinSeconds
   *  (o non specificato se anche restMinSeconds e' null). */
  restMaxSeconds: number | null;
  /** true = l'obiettivo e' "il piu' possibile" (AMRAP), non un numero fisso;
   *  in quel caso targetMinReps/targetMaxReps sono null. */
  isMaxEffort: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  /** denormalizzato per comodita' del client */
  exerciseName: string;
  position: number;
  notes: string | null;
  /** Recupero dopo questo esercizio, prima del successivo (secondi); null = non specificato. */
  restSeconds: number | null;
  /** Vedi WorkoutExerciseInput.progressionIncrement; null = non configurato. */
  progressionIncrement: number | null;
  sets: WorkoutSet[];
}

/** Vista sintetica per la lista schede. */
export interface WorkoutSummary {
  id: string;
  name: string;
  notes: string | null;
  allenamentoId: string;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Vista completa: scheda con esercizi e set. */
export interface WorkoutDetail {
  id: string;
  name: string;
  notes: string | null;
  allenamentoId: string;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

// --- Allenamenti (gruppi di schede) ---

/**
 * Un allenamento raggruppa un sottoinsieme delle schede dell'utente (una
 * scheda appartiene a esattamente un allenamento, vedi WorkoutInput.
 * allenamentoId): permette di seguire un programma o un altro a seconda dei
 * periodi senza dover modificare le schede ogni volta. Al massimo un
 * allenamento per utente ha isActive true (vedi migrazione 018 in
 * workout-service): Registra sessione (nel punto d'accesso generale, non
 * quando si apre una scheda specifica) e il "prossimo esercizio" della
 * Dashboard si limitano alle schede dell'allenamento attivo.
 */
export interface AllenamentoSummary {
  id: string;
  name: string;
  isActive: boolean;
  workoutCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAllenamentoRequest {
  name: string;
}

/** Entrambi i campi opzionali e indipendenti: si puo' rinominare,
 *  attivare, o entrambi nella stessa richiesta. */
export interface UpdateAllenamentoRequest {
  name?: string;
  isActive?: boolean;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionExerciseForm } from "./session-form-utils";

/** Bozza locale del form, indipendente dal token: rete di sicurezza contro
 *  qualunque perdita dei dati inseriti (token scaduto nonostante il
 *  rinnovo di useSlidingSession, app chiusa per sbaglio, blip di rete).
 *  Chiave per scheda: aprire "Registra sessione" per una scheda diversa
 *  non deve mostrare la bozza di un'altra. Equivalente mobile di
 *  apps/web/src/pages/LogSessionPage.tsx (stessa logica, AsyncStorage
 *  invece di localStorage — entrambi async qui, a differenza del web). */
const DRAFT_STORAGE_PREFIX = "gym-tracker.log-session-draft.";
/** Oltre questa età una bozza si considera abbandonata (non un'interruzione
 *  recente da riprendere) e viene ignorata silenziosamente. */
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface SessionDraft {
  performedAt: string;
  exercises: SessionExerciseForm[];
  savedAt: number;
}

function draftKey(workoutId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${workoutId}`;
}

export async function loadSessionDraft(workoutId: string): Promise<SessionDraft | null> {
  const raw = await AsyncStorage.getItem(draftKey(workoutId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SessionDraft;
    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    // Bozza corrotta (es. formato cambiato in una versione precedente):
    // ignorarla silenziosamente, non bloccare il caricamento della schermata.
    return null;
  }
}

export async function saveSessionDraft(
  workoutId: string,
  draft: Omit<SessionDraft, "savedAt">
): Promise<void> {
  await AsyncStorage.setItem(
    draftKey(workoutId),
    JSON.stringify({ ...draft, savedAt: Date.now() })
  );
}

export async function clearSessionDraft(workoutId: string): Promise<void> {
  await AsyncStorage.removeItem(draftKey(workoutId));
}

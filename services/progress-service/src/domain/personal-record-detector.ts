/** Stato permanente del record di un esercizio (vedi migrazione 014):
 *  nullable perche' un esercizio appena loggato per la prima volta non ha
 *  ancora nessun record. */
export interface PersonalRecordState {
  bestWeight: number | null;
  bestWeightReps: number | null;
  bestBodyweightReps: number | null;
}

export const EMPTY_PERSONAL_RECORD_STATE: PersonalRecordState = {
  bestWeight: null,
  bestWeightReps: null,
  bestBodyweightReps: null,
};

/** Un set loggato, nella forma minima richiesta per il confronto (stessa
 *  forma di HistoricalSetPayload in SessionLoggedEvent). */
export interface LoggedSet {
  actualWeight: number | null;
  actualReps: number;
}

export interface NewPersonalRecord {
  kind: "weight" | "bodyweight_reps";
  previousValue: number | null;
  newValue: number;
}

export interface PersonalRecordEvaluation {
  state: PersonalRecordState;
  newRecords: NewPersonalRecord[];
}

/**
 * Confronta i set di UNA sessione (un esercizio) con il record storico e
 * torna lo stato aggiornato + gli eventuali nuovi massimali. Al massimo un
 * evento per tipo per sessione (il miglior set pesato e/o il miglior set a
 * corpo libero di questa sessione, non uno per ogni singolo set che
 * migliora il precedente), non uno per ogni set: una sessione con piu' set
 * che progressivamente battono il record genera una sola notifica per tipo,
 * non una per set.
 *
 * "Massimale" = peso piu' alto mai sollevato (qualunque numero di
 * ripetizioni), oppure — per un esercizio a corpo libero, actualWeight
 * null — rip. piu' alte mai fatte: due metriche indipendenti, un esercizio
 * puo' avere entrambe se e' stato loggato sia pesato che a corpo libero in
 * momenti diversi. Nessuna stima 1RM: scelta deliberata per restare semplice
 * e comprensibile (vedi CLAUDE.md).
 */
export function evaluatePersonalRecords(
  current: PersonalRecordState,
  sets: LoggedSet[]
): PersonalRecordEvaluation {
  const weighted = sets.filter((s) => s.actualWeight !== null);
  const bodyweight = sets.filter((s) => s.actualWeight === null);
  const newRecords: NewPersonalRecord[] = [];
  let state = current;

  if (weighted.length > 0) {
    const best = weighted.reduce((a, b) =>
      (b.actualWeight as number) > (a.actualWeight as number) ? b : a
    );
    const bestWeight = best.actualWeight as number;
    if (current.bestWeight === null) {
      // Primo log in assoluto di questo esercizio pesato: inizializza lo
      // stato senza notificare (non e' un "nuovo" massimale se non ce n'era
      // ancora uno da battere — sarebbe solo rumore al primo utilizzo).
      state = { ...state, bestWeight, bestWeightReps: best.actualReps };
    } else if (bestWeight > current.bestWeight) {
      newRecords.push({ kind: "weight", previousValue: current.bestWeight, newValue: bestWeight });
      state = { ...state, bestWeight, bestWeightReps: best.actualReps };
    }
  }

  if (bodyweight.length > 0) {
    const best = bodyweight.reduce((a, b) => (b.actualReps > a.actualReps ? b : a));
    if (current.bestBodyweightReps === null) {
      state = { ...state, bestBodyweightReps: best.actualReps };
    } else if (best.actualReps > current.bestBodyweightReps) {
      newRecords.push({
        kind: "bodyweight_reps",
        previousValue: current.bestBodyweightReps,
        newValue: best.actualReps,
      });
      state = { ...state, bestBodyweightReps: best.actualReps };
    }
  }

  return { state, newRecords };
}

/** Testo del motivo mostrato in notifica/badge, stesso stile delle altre
 *  reason del motore di regole (vedi progression-rule-engine.ts). */
export function formatPersonalRecordReason(record: NewPersonalRecord): string {
  const unit = record.kind === "weight" ? "kg" : "rip.";
  const previous = record.previousValue === null ? null : `${record.previousValue} ${unit}`;
  return previous
    ? `Nuovo massimale: ${record.newValue} ${unit} (precedente: ${previous})`
    : `Nuovo massimale: ${record.newValue} ${unit}`;
}

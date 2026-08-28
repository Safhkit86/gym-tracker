import { useEffect, useState } from "react";
import type { WorkoutSummary } from "@gym-tracker/shared";
import type { MissingWorkoutGroup, MissingWorkoutResolution } from "./session-import-export";

type Mode = "create" | "map" | "skip";

interface GroupState {
  mode: Mode;
  name: string;
  mappedWorkoutId: string;
}

function initialState(group: MissingWorkoutGroup): GroupState {
  return { mode: "create", name: group.proposedName, mappedWorkoutId: "" };
}

interface SessionImportReviewDialogProps {
  open: boolean;
  groups: MissingWorkoutGroup[];
  existingWorkouts: WorkoutSummary[];
  onConfirm: (resolutions: MissingWorkoutResolution[]) => void;
  onCancel: () => void;
}

/** Pagina di approvazione mostrata quando un import dello storico cita
 *  schede che non esistono (per nome) nel catalogo: per ognuna, chi importa
 *  sceglie se crearla con il nome proposto (eventualmente rinominata),
 *  abbinarla a una scheda già esistente, o scartare le sessioni che la
 *  citano. Non chiama mai l'API da sola: restituisce solo le decisioni,
 *  l'import vero e proprio parte da SessionHistoryPage dopo la conferma. */
export function SessionImportReviewDialog({
  open,
  groups,
  existingWorkouts,
  onConfirm,
  onCancel,
}: SessionImportReviewDialogProps) {
  const [states, setStates] = useState<GroupState[]>([]);

  useEffect(() => {
    if (open) {
      setStates(groups.map(initialState));
    }
    // Solo alla riapertura: se `groups` cambiasse riferimento a dialog gia'
    // aperta (non succede nell'uso attuale) non vogliamo perdere le scelte
    // gia' fatte dall'utente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) {
    return null;
  }

  function updateState(index: number, patch: Partial<GroupState>): void {
    setStates((current) =>
      current.map((state, i) => (i === index ? { ...state, ...patch } : state))
    );
  }

  const canConfirm = states.every(
    (state) =>
      (state.mode === "create" && state.name.trim().length > 0) ||
      (state.mode === "map" && state.mappedWorkoutId !== "") ||
      state.mode === "skip"
  );

  function handleConfirm(): void {
    const resolutions: MissingWorkoutResolution[] = states.map((state) => {
      if (state.mode === "create") {
        return { action: "create", name: state.name.trim() };
      }
      if (state.mode === "map") {
        return { action: "map", workoutId: state.mappedWorkoutId };
      }
      return { action: "skip" };
    });
    onConfirm(resolutions);
  }

  return (
    <div className="confirm-dialog-overlay">
      <div className="review-dialog card" role="alertdialog" aria-modal="true">
        <p>
          {groups.length === 1
            ? "1 scheda citata nel file non è nel tuo catalogo. Decidi come trattarla:"
            : `${groups.length} schede citate nel file non sono nel tuo catalogo. Decidi come trattarle:`}
        </p>
        <div className="review-dialog__groups">
          {groups.map((group, index) => {
            const state = states[index];
            if (!state) {
              return null;
            }
            return (
              <div className="review-dialog__group" key={group.proposedName}>
                <div className="review-dialog__group-header">
                  <h3>{group.proposedName}</h3>
                  <span className="workout-list__meta">
                    {group.sessions.length} {group.sessions.length === 1 ? "sessione" : "sessioni"}
                  </span>
                </div>
                <p className="review-dialog__preview">
                  {group.preview.map((e) => `${e.exerciseName} (${e.setCount} set)`).join(" · ")}
                </p>
                <div className="review-dialog__mode">
                  <button
                    type="button"
                    className={state.mode === "create" ? undefined : "secondary"}
                    onClick={() => updateState(index, { mode: "create" })}
                  >
                    Crea
                  </button>
                  <button
                    type="button"
                    className={state.mode === "map" ? undefined : "secondary"}
                    onClick={() => updateState(index, { mode: "map" })}
                    disabled={existingWorkouts.length === 0}
                  >
                    Abbina a esistente
                  </button>
                  <button
                    type="button"
                    className={state.mode === "skip" ? undefined : "secondary"}
                    onClick={() => updateState(index, { mode: "skip" })}
                  >
                    Scarta
                  </button>
                </div>

                {state.mode === "create" && (
                  <label>
                    Nome della nuova scheda
                    <input
                      value={state.name}
                      onChange={(event) => updateState(index, { name: event.target.value })}
                    />
                  </label>
                )}
                {state.mode === "map" && (
                  <label>
                    Scheda esistente
                    <select
                      value={state.mappedWorkoutId}
                      onChange={(event) =>
                        updateState(index, { mappedWorkoutId: event.target.value })
                      }
                    >
                      <option value="">Scegli…</option>
                      {existingWorkouts.map((workout) => (
                        <option key={workout.id} value={workout.id}>
                          {workout.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {state.mode === "skip" && (
                  <p className="review-dialog__preview">
                    Le sessioni di questa scheda non verranno importate.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="confirm-dialog__actions">
          <button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            Conferma
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { AllenamentoSummary, WorkoutSummary } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import {
  activateAllenamento,
  createAllenamento,
  deleteAllenamento,
  listAllenamenti,
  renameAllenamento,
} from "../api/allenamenti";
import { getWorkout, listWorkouts, updateWorkout } from "../api/workouts";
import { moveWorkoutInput } from "../components/workout-form-utils";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PromptDialog } from "../components/PromptDialog";
import { IconButton } from "../components/IconButton";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../components/icons";

/**
 * Gestione allenamenti (gruppi di schede): una scheda appartiene a
 * esattamente un allenamento (vedi CLAUDE.md), al massimo uno e' attivo.
 * La pagina Schede resta invariata (mostra sempre tutte le schede): questa
 * e' solo il livello di raggruppamento/filtro sopra, come deciso per
 * l'opzione "pagina dedicata" del mockup di confronto.
 */
export function AllenamentiPage() {
  const { token } = useAuth();
  const [allenamenti, setAllenamenti] = useState<AllenamentoSummary[] | null>(null);
  const [workoutsByAllenamento, setWorkoutsByAllenamento] = useState<Map<string, WorkoutSummary[]>>(
    new Map()
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AllenamentoSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AllenamentoSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const list = await listAllenamenti(token);
      setAllenamenti(list);
      const workoutLists = await Promise.all(list.map((a) => listWorkouts(token, a.id)));
      setWorkoutsByAllenamento(new Map(list.map((a, i) => [a.id, workoutLists[i]])));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreateConfirm(name: string): Promise<void> {
    setIsCreating(false);
    if (!token) {
      return;
    }
    setIsBusy(true);
    try {
      await createAllenamento(token, name);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile creare l'allenamento.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRenameConfirm(name: string): Promise<void> {
    const target = renameTarget;
    setRenameTarget(null);
    if (!token || !target) {
      return;
    }
    setIsBusy(true);
    try {
      await renameAllenamento(token, target.id, name);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile rinominare l'allenamento."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleActivate(id: string): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      await activateAllenamento(token, id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile attivare l'allenamento."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!token || !target) {
      return;
    }
    setIsBusy(true);
    try {
      await deleteAllenamento(token, target.id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Impossibile eliminare l'allenamento."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMoveWorkout(workoutId: string, targetAllenamentoId: string): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const detail = await getWorkout(token, workoutId);
      await updateWorkout(token, workoutId, moveWorkoutInput(detail, targetAllenamentoId));
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile spostare la scheda.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main>
      <div className="workouts-list-head">
        <h1>Allenamenti</h1>
        <IconButton
          onClick={() => setIsCreating(true)}
          icon={<PlusIcon />}
          label="Nuovo allenamento"
          variant="accent"
        />
      </div>
      <p>
        Raggruppa le tue schede per programma (es. "Massa", "Definizione"): quello attivo e' quello
        che vedi in Registra sessione dalla Dashboard. Le schede restano comunque tutte visibili in
        "Schede".
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {allenamenti === null && !error && <p>Caricamento…</p>}
      {allenamenti?.map((allenamento) => {
        const workouts = workoutsByAllenamento.get(allenamento.id) ?? [];
        const altri = allenamenti.filter((a) => a.id !== allenamento.id);
        return (
          <section className="card" key={allenamento.id}>
            <div className="workout-group">
              <div>
                <h3>
                  {allenamento.name}{" "}
                  <span
                    className={allenamento.isActive ? "pill pill--active" : "pill pill--inactive"}
                  >
                    {allenamento.isActive ? "Attivo" : "Non attivo"}
                  </span>
                </h3>
                <p>
                  {allenamento.workoutCount} {allenamento.workoutCount === 1 ? "scheda" : "schede"}
                </p>
              </div>
              <div className="workout-list__right">
                {!allenamento.isActive && (
                  <IconButton
                    onClick={() => handleActivate(allenamento.id)}
                    icon={<CheckIcon />}
                    label="Rendi attivo"
                    disabled={isBusy}
                  />
                )}
                <IconButton
                  onClick={() => setRenameTarget(allenamento)}
                  icon={<PencilIcon />}
                  label="Rinomina allenamento"
                  disabled={isBusy}
                />
                <IconButton
                  onClick={() => setDeleteTarget(allenamento)}
                  icon={<TrashIcon />}
                  label="Elimina allenamento"
                  variant="danger"
                  disabled={isBusy}
                />
              </div>
            </div>
            {workouts.length === 0 && <p className="section-note">Nessuna scheda qui.</p>}
            {workouts.length > 0 && (
              <div className="scheda-rows">
                {workouts.map((workout) => (
                  <div className="scheda-row" key={workout.id}>
                    <span className="scheda-row__name">{workout.name}</span>
                    {altri.length > 0 && (
                      <div className="scheda-row__actions">
                        <select
                          aria-label={`Sposta "${workout.name}" in un altro allenamento`}
                          value=""
                          disabled={isBusy}
                          onChange={(event) => {
                            const targetId = event.target.value;
                            if (targetId) {
                              void handleMoveWorkout(workout.id, targetId);
                            }
                          }}
                        >
                          <option value="">Sposta in…</option>
                          {altri.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <PromptDialog
        open={isCreating}
        message="Nuovo allenamento"
        label="Nome"
        initialValue=""
        onConfirm={handleCreateConfirm}
        onCancel={() => setIsCreating(false)}
      />

      <PromptDialog
        open={renameTarget !== null}
        message={`Rinomina "${renameTarget?.name ?? ""}"`}
        label="Nome"
        initialValue={renameTarget?.name ?? ""}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Eliminare l'allenamento "${deleteTarget?.name ?? ""}"? Possibile solo se vuoto e non attivo: sposta prima le sue schede altrove.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

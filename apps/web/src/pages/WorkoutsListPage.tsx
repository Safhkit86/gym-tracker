import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { WorkoutSummary } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import {
  createWorkout,
  deleteWorkout,
  getWorkout,
  listWorkouts,
  reorderWorkouts,
} from "../api/workouts";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PromptDialog } from "../components/PromptDialog";
import { IconButton } from "../components/IconButton";
import { SortableWorkoutItem } from "../components/SortableWorkoutItem";
import { CopyIcon, PlusIcon, TrashIcon } from "../components/icons";
import { duplicateWorkoutInput } from "../components/workout-form-utils";

export function WorkoutsListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<WorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSummary | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<WorkoutSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listWorkouts(token)
      .then((result) => {
        if (!cancelled) {
          setWorkouts(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Errore imprevisto. Riprova.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleDeleteConfirm(): Promise<void> {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!token || !target) {
      return;
    }
    setIsProcessing(true);
    try {
      await deleteWorkout(token, target.id);
      setWorkouts((current) => current?.filter((w) => w.id !== target.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile eliminare la scheda.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDuplicateConfirm(newName: string): Promise<void> {
    const target = duplicateTarget;
    setDuplicateTarget(null);
    if (!token || !target) {
      return;
    }
    setIsProcessing(true);
    try {
      const detail = await getWorkout(token, target.id);
      const result = await createWorkout(token, duplicateWorkoutInput(detail, newName));
      navigate(`/workouts/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossibile duplicare la scheda.");
      setIsProcessing(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (!token || !workouts || !over || active.id === over.id) {
      return;
    }
    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const previous = workouts;
    const reordered = arrayMove(workouts, oldIndex, newIndex);
    setWorkouts(reordered);
    try {
      await reorderWorkouts(
        token,
        reordered.map((w) => w.id)
      );
    } catch (err) {
      setWorkouts(previous);
      setError(err instanceof ApiRequestError ? err.message : "Impossibile riordinare le schede.");
    }
  }

  return (
    <main>
      <div className="workouts-list-head">
        <h1>Le tue schede</h1>
        <IconButton to="/workouts/new" icon={<PlusIcon />} label="Nuova scheda" variant="accent" />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {workouts === null && !error && <p>Caricamento…</p>}
      {workouts?.length === 0 && <p>Non hai ancora nessuna scheda.</p>}
      {workouts && workouts.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={workouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <ul className="workout-list">
              {workouts.map((workout) => (
                <SortableWorkoutItem key={workout.id} id={workout.id}>
                  <div className="workout-list__name">
                    <Link to={`/workouts/${workout.id}`}>{workout.name}</Link>
                    {workout.notes && <p className="workout-list__notes">{workout.notes}</p>}
                  </div>
                  <div className="workout-list__right">
                    <span className="workout-list__meta">
                      {workout.exerciseCount}{" "}
                      {workout.exerciseCount === 1 ? "esercizio" : "esercizi"}
                    </span>
                    <IconButton
                      onClick={() => setDuplicateTarget(workout)}
                      icon={<CopyIcon />}
                      label="Duplica scheda"
                      disabled={isProcessing}
                    />
                    <IconButton
                      onClick={() => setDeleteTarget(workout)}
                      icon={<TrashIcon />}
                      label="Elimina scheda"
                      variant="danger"
                      disabled={isProcessing}
                    />
                  </div>
                </SortableWorkoutItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        message="Sei sicuro di voler eliminare la scheda?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <PromptDialog
        open={duplicateTarget !== null}
        message={`Duplica "${duplicateTarget?.name ?? ""}"`}
        label="Nome della nuova scheda"
        initialValue={`${duplicateTarget?.name ?? ""} (copia)`}
        onConfirm={handleDuplicateConfirm}
        onCancel={() => setDuplicateTarget(null)}
      />
    </main>
  );
}

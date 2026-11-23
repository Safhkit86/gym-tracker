import { useEffect, useState, type FormEvent } from "react";
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
import type { Exercise, WorkoutInput } from "@gym-tracker/shared";
import { ApiRequestError } from "../api/client";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExerciseFieldset } from "./ExerciseFieldset";
import {
  canGroupAsSuperset,
  emptyExercise,
  emptySet,
  extractFieldErrorPaths,
  groupAsSuperset,
  groupByMuscle,
  isLastInSupersetGroup,
  supersetLabels,
  toWorkoutInput,
  ungroupSuperset,
  type ExerciseForm,
  type SetForm,
} from "./workout-form-utils";

interface WorkoutFormProps {
  catalog: Exercise[];
  initialName?: string;
  initialNotes?: string;
  initialExercises?: ExerciseForm[];
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: WorkoutInput) => Promise<void>;
}

export function WorkoutForm({
  catalog,
  initialName,
  initialNotes,
  initialExercises,
  submitLabel,
  submittingLabel,
  onSubmit,
}: WorkoutFormProps) {
  const [name, setName] = useState(initialName ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [exercises, setExercises] = useState<ExerciseForm[]>(
    initialExercises ?? [emptyExercise(catalog[0]?.id ?? "")]
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exerciseToRemove, setExerciseToRemove] = useState<number | null>(null);
  const [scrollToFormId, setScrollToFormId] = useState<string | null>(null);
  // Raggruppamento in superset: modalita' a parte (non un'azione diretta su
  // ogni esercizio) perche' serve selezionarne 2+ prima di poter creare il
  // gruppo. selectedForGroup usa formId (stabile), non indice.
  const [groupModeActive, setGroupModeActive] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [groupError, setGroupError] = useState<string | null>(null);

  function addExercise(): void {
    const defaultId = catalog[0]?.id ?? "";
    const newExercise = emptyExercise(defaultId);
    setExercises((current) => [...current, newExercise]);
    setScrollToFormId(newExercise.formId);
  }

  /** Dopo "Aggiungi esercizio", porta in vista il nuovo riquadro (in fondo
   *  alla pagina) e mette il fuoco sul suo campo di ricerca esercizio, cosi'
   *  si puo' iniziare a compilarlo subito senza scorrere manualmente. */
  useEffect(() => {
    if (!scrollToFormId) {
      return;
    }
    const fieldset = document.querySelector(`[data-form-id="${scrollToFormId}"]`);
    // jsdom (usato dai test) non implementa scrollIntoView: guardia per non
    // far fallire i test che aggiungono un esercizio senza montare un vero browser.
    if (typeof fieldset?.scrollIntoView === "function") {
      fieldset.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    fieldset?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
    setScrollToFormId(null);
  }, [scrollToFormId]);

  function removeExercise(index: number): void {
    setExercises((current) => current.filter((_, i) => i !== index));
  }

  function updateExercise(index: number, patch: Partial<ExerciseForm>): void {
    setExercises((current) =>
      current.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise))
    );
  }

  function addSet(exerciseIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex ? { ...exercise, sets: [...exercise.sets, emptySet()] } : exercise
      )
    );
  }

  /** Aggiunge una copia dell'ultimo set, cosi' non si riparte da zero quando
   * i set successivi hanno gli stessi (o quasi) reps/peso/recupero. */
  function duplicateSet(exerciseIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) => {
        if (i !== exerciseIndex) {
          return exercise;
        }
        const lastSet = exercise.sets[exercise.sets.length - 1];
        return { ...exercise, sets: [...exercise.sets, { ...lastSet }] };
      })
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? { ...exercise, sets: exercise.sets.filter((_, j) => j !== setIndex) }
          : exercise
      )
    );
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetForm>): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
            }
          : exercise
      )
    );
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setExercises((current) => {
      const oldIndex = current.findIndex((exercise) => exercise.formId === active.id);
      const newIndex = current.findIndex((exercise) => exercise.formId === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return current;
      }
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function toggleGroupMode(): void {
    setGroupModeActive((current) => !current);
    setSelectedForGroup(new Set());
    setGroupError(null);
  }

  function toggleSelectedForGroup(formId: string): void {
    setSelectedForGroup((current) => {
      const next = new Set(current);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  }

  function handleCreateSuperset(): void {
    const indices = exercises
      .map((exercise, index) => (selectedForGroup.has(exercise.formId) ? index : -1))
      .filter((index) => index !== -1);
    if (!canGroupAsSuperset(exercises, indices)) {
      setGroupError(
        "Seleziona 2 o piu' esercizi adiacenti, non gia' in un superset, con lo stesso numero di set."
      );
      return;
    }
    setExercises((current) => groupAsSuperset(current, indices));
    setGroupModeActive(false);
    setSelectedForGroup(new Set());
    setGroupError(null);
  }

  function handleUngroup(groupId: string): void {
    setExercises((current) => ungroupSuperset(current, groupId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setFieldErrors(new Set());

    if (exercises.length === 0) {
      setError("Aggiungi almeno un esercizio.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(toWorkoutInput(name, notes, exercises));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(extractFieldErrorPaths(err.details));
      } else {
        setError("Errore imprevisto. Riprova.");
      }
      setIsSubmitting(false);
    }
  }

  const groupedCatalog = groupByMuscle(catalog);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const supersetLabelByFormId = supersetLabels(exercises);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-sticky-toolbar">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        <button type="button" className="secondary" onClick={addExercise}>
          Aggiungi esercizio
        </button>
        <button type="button" className="secondary" onClick={toggleGroupMode}>
          {groupModeActive ? "Annulla" : "Raggruppa esercizi"}
        </button>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {groupModeActive && (
        <div className="toolbar toolbar--end superset-group-bar">
          <span className={groupError ? "form-error" : "section-note"}>
            {groupError ?? "Seleziona 2 o piu' esercizi adiacenti con lo stesso numero di set."}
          </span>
          <button type="button" disabled={selectedForGroup.size < 2} onClick={handleCreateSuperset}>
            Crea superset
          </button>
        </div>
      )}

      <label>
        Nome
        <input
          className={fieldErrors.has("name") ? "invalid" : undefined}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        Note
        <input
          className={fieldErrors.has("notes") ? "invalid" : undefined}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={exercises.map((exercise) => exercise.formId)}
          strategy={verticalListSortingStrategy}
        >
          {exercises.map((exercise, exerciseIndex) => (
            <ExerciseFieldset
              key={exercise.formId}
              exercise={exercise}
              exerciseIndex={exerciseIndex}
              selected={catalogById.get(exercise.exerciseId)}
              groupedCatalog={groupedCatalog}
              fieldErrors={fieldErrors}
              canRemove={exercises.length > 1}
              supersetLabel={supersetLabelByFormId.get(exercise.formId) ?? null}
              showRestSeconds={isLastInSupersetGroup(exercises, exerciseIndex)}
              groupModeActive={groupModeActive}
              isSelectedForGroup={selectedForGroup.has(exercise.formId)}
              onToggleSelectedForGroup={() => toggleSelectedForGroup(exercise.formId)}
              onRequestUngroup={
                exercise.supersetGroupId
                  ? () => handleUngroup(exercise.supersetGroupId as string)
                  : undefined
              }
              onUpdateExercise={(patch) => updateExercise(exerciseIndex, patch)}
              onAddSet={() => addSet(exerciseIndex)}
              onDuplicateSet={() => duplicateSet(exerciseIndex)}
              onRemoveSet={(setIndex) => removeSet(exerciseIndex, setIndex)}
              onUpdateSet={(setIndex, patch) => updateSet(exerciseIndex, setIndex, patch)}
              onRequestRemove={() => setExerciseToRemove(exerciseIndex)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={exerciseToRemove !== null}
        message="Sei sicuro di voler eliminare l'esercizio?"
        onConfirm={() => {
          if (exerciseToRemove !== null) {
            removeExercise(exerciseToRemove);
          }
          setExerciseToRemove(null);
        }}
        onCancel={() => setExerciseToRemove(null)}
      />
    </form>
  );
}

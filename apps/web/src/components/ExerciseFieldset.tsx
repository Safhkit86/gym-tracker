import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise } from "@gym-tracker/shared";
import { GripIcon } from "./icons";
import type { ExerciseForm, SetForm } from "./workout-form-utils";

interface ExerciseFieldsetProps {
  exercise: ExerciseForm;
  exerciseIndex: number;
  selected: Exercise | undefined;
  groupedCatalog: Array<[string, Exercise[]]>;
  canRemove: boolean;
  onUpdateExercise: (patch: Partial<ExerciseForm>) => void;
  onAddSet: () => void;
  onDuplicateSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onUpdateSet: (setIndex: number, patch: Partial<SetForm>) => void;
  onRequestRemove: () => void;
}

/** Estratto da WorkoutForm perche' useSortable (un hook) non puo' essere
 *  chiamato dentro la callback di un .map(). */
export function ExerciseFieldset({
  exercise,
  exerciseIndex,
  selected,
  groupedCatalog,
  canRemove,
  onUpdateExercise,
  onAddSet,
  onDuplicateSet,
  onRemoveSet,
  onUpdateSet,
  onRequestRemove,
}: ExerciseFieldsetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.formId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <fieldset
      ref={setNodeRef}
      style={style}
      className={`exercise-form${isDragging ? " exercise-form--dragging" : ""}`}
    >
      <legend>Esercizio {exerciseIndex + 1}</legend>
      <button
        type="button"
        className="icon-btn exercise-form__drag-handle"
        aria-label="Trascina per riordinare"
        data-tip="Trascina per riordinare"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {/* Il <select> NON e' annidato nel <label> (a differenza degli
          altri campi): il nome accessibile di un <label> include il
          testo di tutti i suoi discendenti, quindi annidare un select
          con decine di <option> lo renderebbe "Esercizio Affondi Hack
          squat ..." per uno screen reader. Associazione esplicita via
          htmlFor/id, con i due come fratelli. */}
      <div className="field">
        <label htmlFor={`exercise-select-${exerciseIndex}`}>Esercizio</label>
        <select
          id={`exercise-select-${exerciseIndex}`}
          value={exercise.exerciseId}
          onChange={(event) => onUpdateExercise({ exerciseId: event.target.value })}
        >
          {groupedCatalog.map(([muscleGroup, items]) => (
            <optgroup key={muscleGroup} label={muscleGroup}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selected?.description && (
        <p className="exercise-description">
          {selected.description}{" "}
          {selected.sourceUrl && (
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
              Scopri di più
            </a>
          )}
        </p>
      )}

      {exercise.sets.map((set, setIndex) => (
        <div key={setIndex} className="set-form-row">
          <label>
            Rep minime
            <input
              type="number"
              min={1}
              value={set.targetMinReps}
              onChange={(event) => onUpdateSet(setIndex, { targetMinReps: event.target.value })}
              required
            />
          </label>
          <label>
            Rep massime (opzionale)
            <input
              type="number"
              min={1}
              value={set.targetMaxReps}
              onChange={(event) => onUpdateSet(setIndex, { targetMaxReps: event.target.value })}
            />
          </label>
          <label>
            Peso (kg)
            <input
              type="number"
              min={0}
              step="0.5"
              value={set.targetWeight}
              onChange={(event) => onUpdateSet(setIndex, { targetWeight: event.target.value })}
            />
          </label>
          <label>
            Recupero (s)
            <input
              type="number"
              min={0}
              value={set.restSeconds}
              onChange={(event) => onUpdateSet(setIndex, { restSeconds: event.target.value })}
            />
          </label>
          {exercise.sets.length > 1 && (
            <button type="button" className="secondary" onClick={() => onRemoveSet(setIndex)}>
              Rimuovi set
            </button>
          )}
        </div>
      ))}
      <div className="exercise-form__actions">
        <button type="button" className="secondary" onClick={onAddSet}>
          Aggiungi set
        </button>
        <button type="button" className="secondary" onClick={onDuplicateSet}>
          Duplica ultimo set
        </button>
      </div>

      <label>
        Recupero prima del prossimo esercizio (s)
        <input
          type="number"
          min={0}
          value={exercise.restSeconds}
          onChange={(event) => onUpdateExercise({ restSeconds: event.target.value })}
        />
      </label>

      <label>
        Incremento di progressione (kg o reps)
        <input
          type="number"
          min={0}
          step="0.5"
          value={exercise.progressionIncrement}
          onChange={(event) => onUpdateExercise({ progressionIncrement: event.target.value })}
        />
      </label>

      {canRemove && (
        <button type="button" className="secondary" onClick={onRequestRemove}>
          Rimuovi esercizio
        </button>
      )}
    </fieldset>
  );
}

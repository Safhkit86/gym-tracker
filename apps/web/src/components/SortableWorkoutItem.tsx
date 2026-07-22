import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripIcon } from "./icons";

interface SortableWorkoutItemProps {
  id: string;
  children: ReactNode;
}

/** Estratto da WorkoutsListPage perche' useSortable (un hook) non puo' essere
 *  chiamato dentro la callback di un .map(). */
export function SortableWorkoutItem({ id, children }: SortableWorkoutItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`card workout-list__item${isDragging ? " workout-list__item--dragging" : ""}`}
    >
      <button
        type="button"
        className="icon-btn workout-list__drag-handle"
        aria-label="Trascina per riordinare"
        data-tip="Trascina per riordinare"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {children}
    </li>
  );
}

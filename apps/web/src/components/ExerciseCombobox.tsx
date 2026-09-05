import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Exercise } from "@gym-tracker/shared";

interface ExerciseComboboxProps {
  id: string;
  value: string;
  selected: Exercise | undefined;
  groupedCatalog: Array<[string, Exercise[]]>;
  onChange: (exerciseId: string) => void;
}

/** Filtra il catalogo raggruppato per nome (case-insensitive, sottostringa),
 *  scartando i gruppi rimasti senza risultati. */
function filterGroups(
  groupedCatalog: Array<[string, Exercise[]]>,
  query: string
): Array<[string, Exercise[]]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return groupedCatalog;
  }
  return groupedCatalog
    .map<[string, Exercise[]]>(([muscleGroup, items]) => [
      muscleGroup,
      items.filter((item) => item.name.toLowerCase().includes(q)),
    ])
    .filter(([, items]) => items.length > 0);
}

/** Sostituisce il <select> semplice: un campo di testo che filtra il
 *  catalogo (raggruppato per muscolo) mentre digiti. Segue il pattern ARIA
 *  combobox — navigazione con le frecce via aria-activedescendant, nessun
 *  vero focus DOM sulle opzioni (altrimenti Tab dal campo di ricerca
 *  passerebbe per ogni opzione invece che al campo successivo del form). */
export function ExerciseCombobox({
  id,
  value,
  selected,
  groupedCatalog,
  onChange,
}: ExerciseComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const filtered = filterGroups(groupedCatalog, isOpen ? query : "");
  const flatItems = filtered.flatMap(([, items]) => items);

  // Chiude la lista al click fuori dal componente (il mousedown sulle
  // opzioni chiama preventDefault, quindi non arriva mai fin qui per loro).
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  function open(): void {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(-1);
  }

  function close(): void {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function selectItem(item: Exercise): void {
    onChange(item.id);
    close();
    // L'input resta focus dopo il mousedown (preventDefault sull'opzione,
    // altrimenti il blur chiuderebbe la lista prima del click): senza un
    // blur esplicito qui, un click successivo sull'input gia' focus non
    // genera un nuovo evento "focus" e la lista non si riaprirebbe piu'.
    inputRef.current?.blur();
  }

  function optionId(index: number): string {
    return `${listboxId}-option-${index}`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      setActiveIndex((current) => Math.min(current + 1, flatItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (isOpen && activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        selectItem(flatItems[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        close();
        event.currentTarget.blur();
      }
    }
  }

  return (
    <div className="exercise-combobox" ref={containerRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        placeholder="Cerca esercizio…"
        value={isOpen ? query : (selected?.name ?? "")}
        onFocus={open}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <ul
          className="exercise-combobox__listbox"
          role="listbox"
          id={listboxId}
          aria-label="Esercizi"
        >
          {flatItems.length === 0 && (
            <li className="exercise-combobox__empty">Nessun esercizio trovato.</li>
          )}
          {(() => {
            let index = -1;
            return filtered.map(([muscleGroup, items]) => (
              <li
                key={muscleGroup}
                className="exercise-combobox__group"
                role="group"
                aria-label={muscleGroup}
              >
                <span className="exercise-combobox__group-label">{muscleGroup}</span>
                <ul className="exercise-combobox__options">
                  {items.map((item) => {
                    index += 1;
                    const optionIndex = index;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          id={optionId(optionIndex)}
                          role="option"
                          aria-selected={item.id === value}
                          tabIndex={-1}
                          className={
                            optionIndex === activeIndex
                              ? "exercise-combobox__option exercise-combobox__option--active"
                              : "exercise-combobox__option"
                          }
                          onMouseEnter={() => setActiveIndex(optionIndex)}
                          onMouseDown={(event) => {
                            // Altrimenti il blur dell'input (che chiude la
                            // lista) arriva prima del click e la lista
                            // sparisce senza che la selezione avvenga.
                            event.preventDefault();
                            selectItem(item);
                          }}
                        >
                          {item.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ));
          })()}
        </ul>
      )}
    </div>
  );
}

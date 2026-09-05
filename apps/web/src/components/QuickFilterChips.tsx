import { QUICK_FILTER_PRESETS, type QuickFilterPreset } from "../utils/quick-filters";

interface QuickFilterChipsProps {
  value: QuickFilterPreset;
  onChange: (preset: QuickFilterPreset) => void;
}

/** Filtri rapidi periodo (1M/3M/1Y/5Y/Tutto) per Storico: stesso pattern
 *  attivo/secondary dei pulsanti Sessioni/Misure sopra, non una nuova
 *  componente visiva. */
export function QuickFilterChips({ value, onChange }: QuickFilterChipsProps) {
  return (
    <div className="toolbar" role="group" aria-label="Filtro periodo">
      {QUICK_FILTER_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          className={preset.value === value ? undefined : "secondary"}
          onClick={() => onChange(preset.value)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

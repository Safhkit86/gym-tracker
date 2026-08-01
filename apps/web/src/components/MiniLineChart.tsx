export interface ChartPoint {
  id: string;
  date: string;
  value: number;
}

interface MiniLineChartProps {
  points: ChartPoint[];
  /** Es. "kg", "cm": appeso al valore. "reps" mostra il numero senza suffisso. */
  unit: string;
  emptyMessage?: string;
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 110;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 340;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 80;

function formatValue(value: number, unit: string): string {
  return unit === "reps" ? `${value}` : `${value}${unit}`;
}

function formatTickDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

/** Grafico a linea riusabile per uno storico nel tempo (peso/ripetizioni di
 *  un esercizio, o una misura corporea): stesso linguaggio visivo validato
 *  nel mockup della Dashboard, con punti reali normalizzati su min/max.
 *  Serie singola: niente legenda, solo l'ultimo punto etichettato. */
export function MiniLineChart({ points, unit, emptyMessage }: MiniLineChartProps) {
  if (points.length === 0) {
    return <p className="chart-empty">{emptyMessage ?? "Nessuno storico disponibile."}</p>;
  }

  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;

  function xFor(index: number): number {
    return points.length === 1
      ? PLOT_RIGHT
      : PLOT_LEFT + (index / (points.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);
  }

  function yFor(value: number): number {
    return range === 0
      ? (PLOT_TOP + PLOT_BOTTOM) / 2
      : PLOT_BOTTOM - ((value - minValue) / range) * (PLOT_BOTTOM - PLOT_TOP);
  }

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.value), point: p }));
  const last = coords[coords.length - 1];
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const tickIndexes =
    coords.length <= 4
      ? coords.map((_, i) => i)
      : [
          0,
          Math.round((coords.length - 1) / 3),
          Math.round(((coords.length - 1) * 2) / 3),
          coords.length - 1,
        ];
  const uniqueTickIndexes = [...new Set(tickIndexes)];

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
      height={CHART_HEIGHT}
      role="img"
      aria-label={`Andamento: ${formatValue(minValue, unit)} - ${formatValue(maxValue, unit)}`}
    >
      <line
        className="axis-line"
        x1={PLOT_LEFT - 10}
        y1={PLOT_BOTTOM}
        x2={PLOT_RIGHT + 10}
        y2={PLOT_BOTTOM}
      />
      {coords.length > 1 && <polyline className="data-line" points={polylinePoints} />}
      {coords.map((c, i) => (
        <circle
          key={c.point.id}
          className={i === coords.length - 1 ? "data-dot data-dot--last" : "data-dot"}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 5 : 4}
        />
      ))}
      <text
        className="value-label"
        x={Math.min(last.x + 10, CHART_WIDTH - 30)}
        y={Math.max(last.y - 8, 14)}
      >
        {formatValue(last.point.value, unit)}
      </text>
      {uniqueTickIndexes.map((i) => (
        <text
          key={coords[i].point.id}
          x={coords[i].x}
          y={PLOT_BOTTOM + 18}
          fontSize={10}
          textAnchor="middle"
        >
          {formatTickDate(coords[i].point.date)}
        </text>
      ))}
    </svg>
  );
}

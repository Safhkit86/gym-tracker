import type { ExerciseHistoryPoint } from "@gym-tracker/shared";

interface MiniLineChartProps {
  points: ExerciseHistoryPoint[];
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 110;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 340;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 80;

function formatValue(value: number, unit: "kg" | "reps"): string {
  return unit === "kg" ? `${value}kg` : `${value}`;
}

function formatTickDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

/** Grafico a linea per lo storico di un esercizio (peso o ripetizioni nel
 *  tempo): stesso linguaggio visivo validato nel mockup della Dashboard, ma
 *  con punti reali normalizzati su min/max invece di coordinate scritte a
 *  mano. Serie singola: niente legenda, solo l'ultimo punto etichettato. */
export function MiniLineChart({ points }: MiniLineChartProps) {
  if (points.length === 0) {
    return <p className="chart-empty">Nessuno storico disponibile per questo esercizio.</p>;
  }

  const unit = points[0].unit;
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
          key={c.point.sessionId}
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
          key={coords[i].point.sessionId}
          x={coords[i].x}
          y={PLOT_BOTTOM + 18}
          fontSize={10}
          textAnchor="middle"
        >
          {formatTickDate(coords[i].point.performedAt)}
        </text>
      ))}
    </svg>
  );
}

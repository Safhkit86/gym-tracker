import { Text as RNText, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/theme";

export interface ChartPoint {
  id: string;
  date: string;
  value: number;
}

interface MiniLineChartProps {
  points: ChartPoint[];
  /** Es. "kg": appeso al valore. "reps" mostra il numero senza suffisso. */
  unit: string;
  emptyMessage: string;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 110;
const PLOT_LEFT = 30;
const PLOT_RIGHT = 300;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 80;

function formatValue(value: number, unit: string): string {
  return unit === "reps" ? `${value}` : `${value}${unit}`;
}

function formatTickDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

/** Grafico a linea riusabile per uno storico nel tempo (peso/ripetizioni di
 *  un esercizio), stessa logica di apps/web/src/components/MiniLineChart.tsx
 *  ma disegnato con react-native-svg invece di SVG DOM diretto — libreria
 *  puramente JS+SVG, nessuna dipendenza reanimated/skia/worklets (vedi nota
 *  su Expo Go in CLAUDE.md). Serie singola: niente legenda, solo l'ultimo
 *  punto etichettato. */
export function MiniLineChart({ points, unit, emptyMessage }: MiniLineChartProps) {
  if (points.length === 0) {
    return (
      <View style={{ paddingVertical: 8 }}>
        <RNText style={{ color: colors.textMuted, fontSize: 12 }}>{emptyMessage}</RNText>
      </View>
    );
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
  if (!last) {
    return null;
  }
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
  const tickCoords = [...new Set(tickIndexes)]
    .map((i) => coords[i])
    .filter((c): c is (typeof coords)[number] => c !== undefined);

  return (
    <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
      <Line
        x1={PLOT_LEFT - 10}
        y1={PLOT_BOTTOM}
        x2={PLOT_RIGHT + 10}
        y2={PLOT_BOTTOM}
        stroke={colors.border}
        strokeWidth={1}
      />
      {coords.length > 1 && (
        <Polyline points={polylinePoints} fill="none" stroke={colors.accent} strokeWidth={2} />
      )}
      {coords.map((c, i) => (
        <Circle
          key={c.point.id}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 5 : 4}
          fill={i === coords.length - 1 ? colors.accent : colors.surface2}
          stroke={colors.accent}
          strokeWidth={i === coords.length - 1 ? 0 : 1.5}
        />
      ))}
      <SvgText
        x={Math.min(last.x + 10, CHART_WIDTH - 30)}
        y={Math.max(last.y - 8, 14)}
        fontSize={12}
        fontWeight="700"
        fill={colors.text}
      >
        {formatValue(last.point.value, unit)}
      </SvgText>
      {tickCoords.map((c) => (
        <SvgText
          key={c.point.id}
          x={c.x}
          y={PLOT_BOTTOM + 18}
          fontSize={10}
          fill={colors.textMuted}
          textAnchor="middle"
        >
          {formatTickDate(c.point.date)}
        </SvgText>
      ))}
    </Svg>
  );
}

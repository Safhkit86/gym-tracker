import { useState } from "react";
import { Text as RNText, View, type LayoutChangeEvent } from "react-native";
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

const CHART_HEIGHT = 110;
const PLOT_LEFT = 30;
const PLOT_MARGIN_RIGHT = 20;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 80;
/** Larghezza di fallback finché onLayout non ha ancora misurato il
 *  container reale (primo render) — stesso valore usato prima di questo
 *  fix come CHART_WIDTH fisso. */
const FALLBACK_WIDTH = 320;

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
 *  punto etichettato.
 *
 *  La larghezza del plot è misurata via onLayout invece di un CHART_WIDTH
 *  fisso: con `width="100%"` su un viewBox a larghezza fissa, l'SVG non si
 *  deforma (preserveAspectRatio di default "xMidYMid meet" lo centra),
 *  ma su un container più largo del viewBox (una card a piena larghezza
 *  tablet) resta grande quanto il viewBox originale con spazio vuoto ai
 *  lati — non sfrutta lo spazio extra, contrario all'obiettivo di un vero
 *  layout tablet. Misurando la larghezza reale e usandola sia per `width`
 *  sia per il `viewBox`, la geometria del plot si estende alla larghezza
 *  reale mentre `fontSize` resta costante (con un viewBox scalato il testo
 *  scalerebbe con lui). */
export function MiniLineChart({ points, unit, emptyMessage }: MiniLineChartProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent): void {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== measuredWidth) {
      setMeasuredWidth(width);
    }
  }

  if (points.length === 0) {
    return (
      <View style={{ paddingVertical: 8 }}>
        <RNText style={{ color: colors.textMuted, fontSize: 12 }}>{emptyMessage}</RNText>
      </View>
    );
  }

  const chartWidth = measuredWidth > 0 ? measuredWidth : FALLBACK_WIDTH;
  const plotRight = chartWidth - PLOT_MARGIN_RIGHT;

  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;

  function xFor(index: number): number {
    return points.length === 1
      ? plotRight
      : PLOT_LEFT + (index / (points.length - 1)) * (plotRight - PLOT_LEFT);
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
    <View onLayout={handleLayout}>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Line
          x1={PLOT_LEFT - 10}
          y1={PLOT_BOTTOM}
          x2={plotRight + 10}
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
          x={Math.min(last.x + 10, chartWidth - 30)}
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
    </View>
  );
}

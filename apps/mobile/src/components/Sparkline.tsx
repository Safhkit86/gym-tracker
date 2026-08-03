import Svg, { Circle, Polyline } from "react-native-svg";
import { colors } from "../theme/theme";

interface SparklineProps {
  values: number[];
}

const WIDTH = 140;
const HEIGHT = 36;
const PADDING = 4;

/** Mini-grafico senza assi/etichette per un riepilogo a colpo d'occhio (tile
 *  "Misure" in Dashboard), stessa logica di
 *  apps/web/src/components/Sparkline.tsx — a differenza di MiniLineChart non
 *  mostra date ne' l'ultimo valore (gia' presente accanto, nella tile
 *  stessa). */
export function Sparkline({ values }: SparklineProps) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  function xFor(index: number): number {
    return PADDING + (index / (values.length - 1)) * (WIDTH - PADDING * 2);
  }

  function yFor(value: number): number {
    return range === 0
      ? HEIGHT / 2
      : HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
  }

  const points = values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const lastIndex = values.length - 1;
  const lastValue = values[lastIndex];
  if (lastValue === undefined) {
    return null;
  }

  return (
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={1.5} />
      <Circle cx={xFor(lastIndex)} cy={yFor(lastValue)} r={2.5} fill={colors.accent} />
    </Svg>
  );
}

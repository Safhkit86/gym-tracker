/** Palette "Night Track", stessi valori di apps/web/src/index.css (:root) —
 *  un solo tema fisso, non dipende da preferenze di sistema (stessa scelta
 *  della webapp). Vedi CLAUDE.md per il contesto della scelta del tema. */
export const colors = {
  bg: "#0c1420",
  surface: "#121d2d",
  surface2: "#17233a",
  text: "#e7eef6",
  textMuted: "#8ea2ba",
  border: "#22314a",
  accent: "#22c3b0",
  accentHover: "#4fe0cf",
  accentContrast: "#06211d",
  danger: "#f87171",
  dangerBg: "#2a1618",
  warning: "#f5b942",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
} as const;

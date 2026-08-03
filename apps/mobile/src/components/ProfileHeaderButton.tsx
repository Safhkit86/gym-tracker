import { TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, spacing } from "../theme/theme";

/** Icona condivisa nell'header di ogni tab (Dashboard/Schede/Storico/
 *  Statistiche/Notifiche) per raggiungere il Profilo — equivalente mobile
 *  del link con l'email dell'utente nella barra di navigazione persistente
 *  della webapp (`apps/web/src/components/Layout.tsx`), che pero' qui non
 *  esiste (solo le 5 tab in basso): l'icona va quindi ripetuta nell'header
 *  nativo di ciascun *Navigator invece che in un unico posto globale.
 *  SVG (`react-native-svg`, gia' dipendenza per MiniLineChart/Sparkline)
 *  invece di un glifo testuale come gli altri glifi dell'app (vedi
 *  MainTabNavigator): testato empiricamente su emulatore che qualunque
 *  glifo Unicode "persona/faccia" riconoscibile (es. "👤" BUST IN
 *  SILHOUETTE, "☺" WHITE SMILING FACE, anche con il selettore di
 *  presentazione testuale U+FE0E) viene comunque disegnato da Android col
 *  colore fisso del font emoji (qui blu/giallo), ignorando lo style
 *  `color` del `Text` — stesso motivo per cui l'icona Notifiche e' "✉" e
 *  non "🔔" (vedi memoria), ma qui non esiste un glifo di ricambio
 *  monocromatico che sia anche riconoscibile come persona (un pedone di
 *  scacchi ci arrivava vicino ma l'utente ha chiesto una figura umana
 *  vera). Un piccolo SVG con `fill={colors.text}` garantisce lo stesso
 *  colore delle altre icone su ogni piattaforma, senza dipendere dal
 *  font emoji del sistema. */
export function ProfileHeaderButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("profile.title")}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ marginRight: spacing.sm }}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx="12" cy="8" r="4" fill={colors.text} />
        <Path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={colors.text} />
      </Svg>
    </TouchableOpacity>
  );
}

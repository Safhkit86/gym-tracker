import { Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, spacing } from "../theme/theme";

/** Icona condivisa nell'header di ogni tab (Dashboard/Schede/Storico/
 *  Statistiche/Notifiche) per raggiungere il Profilo — equivalente mobile
 *  del link con l'email dell'utente nella barra di navigazione persistente
 *  della webapp (`apps/web/src/components/Layout.tsx`), che pero' qui non
 *  esiste (solo le 5 tab in basso): l'icona va quindi ripetuta nell'header
 *  nativo di ciascun *Navigator invece che in un unico posto globale.
 *  Glifo testuale "♟" invece di un'icon library dedicata, stesso principio
 *  degli altri glifi dell'app (vedi MainTabNavigator). Non "👤"/"☺": sono
 *  glifi emoji-presentation, Android li disegna sempre a colori fissi
 *  (qui blu/giallo) ignorando lo style `color` del `Text` — stesso motivo
 *  per cui l'icona Notifiche era "✉" e non "🔔" (vedi memoria). Un pedone
 *  degli scacchi resta invece monocromatico e prende il tint del tema,
 *  leggibile come una piccola figura stilizzata ("omino"). */
export function ProfileHeaderButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("profile.title")}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={{ color: colors.text, fontSize: 20, marginRight: spacing.sm }}>♟</Text>
    </TouchableOpacity>
  );
}

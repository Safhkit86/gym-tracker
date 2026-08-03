import type { TFunction } from "i18next";

/** "N di M": stesso testo usato da ogni widget che ha rimpiazzato le frecce
 *  di PagerControls con uno swipe (Dashboard e, condividendo StatisticheCard,
 *  anche Statistiche) — un solo indicatore testuale, niente frecce da
 *  mantenere/tradurre. */
export function formatItemIndicator(t: TFunction, index: number, total: number): string {
  return t("dashboard.itemIndicator", { index: index + 1, total });
}

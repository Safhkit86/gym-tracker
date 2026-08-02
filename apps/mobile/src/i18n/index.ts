import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import it from "./locales/it.json";
import en from "./locales/en.json";

const SUPPORTED_LANGUAGES = ["it", "en"] as const;
const FALLBACK_LANGUAGE = "it";

// Prima lingua del dispositivo che supportiamo; altrimenti l'italiano
// (stessa lingua di default della webapp oggi).
const deviceLanguage =
  Localization.getLocales().find((locale) =>
    SUPPORTED_LANGUAGES.includes(locale.languageCode as (typeof SUPPORTED_LANGUAGES)[number])
  )?.languageCode ?? FALLBACK_LANGUAGE;

void i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: deviceLanguage,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false }, // React gia' fa l'escaping
});

export default i18n;

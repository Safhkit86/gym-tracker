import type { TFunction } from "i18next";
import { ApiRequestError } from "./client";

/**
 * Risolve un errore in un messaggio nella lingua attiva. Cerca `code` nel
 * catalogo `errors.*` (vedi src/i18n/locales/*.json, allineato ai codici
 * di packages/shared/src/error-codes.ts); se il codice non e' ancora
 * mappato, usa il messaggio del backend cosi' com'e' (oggi sempre in
 * italiano) come fallback, invece di un generico "errore sconosciuto" —
 * meglio un messaggio nella lingua sbagliata che nessun messaggio.
 */
export function translateError(err: unknown, t: TFunction): string {
  if (!(err instanceof ApiRequestError)) {
    return t("common.errorUnexpected");
  }
  const key = `errors.${err.code}`;
  return t(key, { defaultValue: err.message });
}

import { createHash, randomBytes, randomInt } from "node:crypto";

/** Token di reset password: casuale, imprevedibile, da inserire nel link email. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/** OTP a 6 cifre per la conferma via email del cambio password. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Mai salvare token/OTP in chiaro: solo l'hash, con lookup indicizzato sull'hash. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

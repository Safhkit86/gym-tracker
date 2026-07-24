import type { Mailer } from "./mailer.js";
import type { PasswordHasher } from "./password.js";
import { generateOtp, hashToken } from "./security-tokens.js";
import {
  InvalidCurrentPasswordError,
  InvalidOtpError,
  NoPendingPasswordChangeError,
  UnauthorizedError,
} from "../errors.js";
import type { PasswordActionTokenRepository } from "../repositories/password-action-token-repository.js";
import type { UserRepository } from "../repositories/user-repository.js";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minuti
const MAX_OTP_ATTEMPTS = 5;

/**
 * Cambio password da utente gia' autenticato: richiede la password attuale
 * (re-autenticazione) E un codice via email (secondo fattore) prima di
 * applicare la modifica -- difesa in profondita' per un'azione sensibile.
 * Il nuovo hash e' calcolato subito e tenuto in sospeso finche' l'OTP non
 * viene confermato, cosi' la password vera e propria non transita mai due volte.
 */
export class PasswordChangeService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordActionTokens: PasswordActionTokenRepository,
    private readonly passwords: PasswordHasher,
    private readonly mailer: Mailer
  ) {}

  async requestChange(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const currentOk = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!currentOk) {
      throw new InvalidCurrentPasswordError();
    }

    const pendingPasswordHash = await this.passwords.hash(newPassword);
    const otp = generateOtp();
    await this.passwordActionTokens.create({
      userId: user.id,
      purpose: "change",
      tokenHash: hashToken(otp),
      pendingPasswordHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await this.mailer.send({
      to: user.email,
      subject: "Codice per confermare il cambio password - gym-tracker",
      text:
        `Hai richiesto di cambiare la password del tuo account gym-tracker.\n\n` +
        `Codice di conferma (valido 10 minuti): ${otp}\n\n` +
        `Se non hai richiesto tu questo cambio, ignora questa email e considera di cambiare comunque la password.`,
    });

    return { message: "Codice di conferma inviato via email." };
  }

  async confirmChange(userId: string, otp: string): Promise<{ message: string }> {
    const pending = await this.passwordActionTokens.findLatestActive(userId, "change");
    if (!pending) {
      throw new NoPendingPasswordChangeError();
    }
    if (pending.attempts >= MAX_OTP_ATTEMPTS) {
      throw new NoPendingPasswordChangeError();
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      throw new InvalidOtpError();
    }

    if (hashToken(otp) !== pending.tokenHash) {
      await this.passwordActionTokens.incrementAttempts(pending.id);
      throw new InvalidOtpError();
    }

    // pendingPasswordHash e' sempre presente per purpose='change' (impostato in requestChange).
    await this.users.updatePassword(userId, pending.pendingPasswordHash as string);
    await this.passwordActionTokens.markUsed(pending.id);

    return { message: "Password aggiornata correttamente." };
  }
}

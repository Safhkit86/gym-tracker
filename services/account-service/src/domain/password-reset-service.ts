import type { Mailer } from "./mailer.js";
import type { PasswordHasher } from "./password.js";
import { generateResetToken, hashToken } from "./security-tokens.js";
import { InvalidResetTokenError } from "../errors.js";
import type {
  NewPasswordActionToken,
  PasswordActionTokenRepository,
} from "../repositories/password-action-token-repository.js";
import type { UserRepository } from "../repositories/user-repository.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minuti
const RESET_COOLDOWN_MS = 60 * 1000; // 1 minuto tra due richieste per la stessa email

const GENERIC_MESSAGE = {
  message: "Se l'account esiste, riceverai un'email con le istruzioni per reimpostare la password.",
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Reset password self-service (utente non autenticato). Segue OWASP Forgot
 * Password Cheat Sheet: risposta generica identica indipendentemente
 * dall'esistenza dell'account (no user enumeration), token casuale hashato a
 * riposo, scadenza, uso singolo, cooldown per non permettere di sommergere
 * la vittima di email da IP diversi (il rate limit del gateway e' per IP).
 */
export class PasswordResetService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordActionTokens: PasswordActionTokenRepository,
    private readonly passwords: PasswordHasher,
    private readonly mailer: Mailer,
    private readonly webAppUrl: string
  ) {}

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    if (!user) {
      return GENERIC_MESSAGE;
    }

    const active = await this.passwordActionTokens.findLatestActive(user.id, "reset");
    if (active && Date.now() - active.createdAt.getTime() < RESET_COOLDOWN_MS) {
      return GENERIC_MESSAGE;
    }

    const rawToken = generateResetToken();
    const newToken: NewPasswordActionToken = {
      userId: user.id,
      purpose: "reset",
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    };
    await this.passwordActionTokens.create(newToken);

    const resetUrl = `${this.webAppUrl}/reset-password?token=${rawToken}`;
    await this.mailer.send({
      to: user.email,
      subject: "Reimposta la tua password - gym-tracker",
      text:
        `Hai richiesto di reimpostare la password del tuo account gym-tracker.\n\n` +
        `Apri questo link per scegliere una nuova password (valido 30 minuti):\n${resetUrl}\n\n` +
        `Se non hai richiesto tu questo reset, ignora questa email: la tua password resta invariata.`,
    });

    return GENERIC_MESSAGE;
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const record = await this.passwordActionTokens.findByHash(hashToken(token), "reset");
    if (!record || record.usedAt !== null || record.expiresAt.getTime() < Date.now()) {
      throw new InvalidResetTokenError();
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.users.updatePassword(record.userId, passwordHash);
    await this.passwordActionTokens.markUsed(record.id);

    return { message: "Password reimpostata correttamente." };
  }
}

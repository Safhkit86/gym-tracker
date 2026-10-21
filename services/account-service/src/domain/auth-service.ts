import type {
  AccessTokenService,
  AuthResponse,
  LoginRequest,
  PublicUser,
  RegisterRequest,
} from "@gym-tracker/shared";
import { AccountLockedError, EmailAlreadyInUseError, InvalidCredentialsError } from "../errors.js";
import type { UserRecord, UserRepository } from "../repositories/user-repository.js";
import type { PasswordHasher } from "./password.js";

// Lockout per account dopo troppi login falliti consecutivi: il rate limit
// del gateway e' per IP (vedi services/api-gateway/src/rate-limit.ts), non
// per account, quindi non basta contro un attacco a bassa frequenza
// distribuito su molti IP. Soglia/durata in linea con le linee guida OWASP
// (3-5 tentativi, 15-30 minuti) — non configurabili via env per ora, stesso
// stile delle costanti di password-reset-service.ts.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Normalizza l'email per confronto/unicita' (case-insensitive). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isLocked(user: UserRecord): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Logica di autenticazione: registrazione, login ed emissione del token.
 * Riceve le collaboratrici per iniezione (repository, hasher, token service)
 * cosi' e' testabile in isolamento.
 */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AccessTokenService
  ) {}

  async register({ email, password }: RegisterRequest): Promise<AuthResponse> {
    const normalized = normalizeEmail(email);

    const existing = await this.users.findByEmail(normalized);
    if (existing) {
      throw new EmailAlreadyInUseError(normalized);
    }

    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.create({ email: normalized, passwordHash });

    return this.buildResponse(user);
  }

  async login({ email, password }: LoginRequest): Promise<AuthResponse> {
    const normalized = normalizeEmail(email);

    const user = await this.users.findByEmail(normalized);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (isLocked(user)) {
      // user.lockedUntil non puo' essere null qui: isLocked() lo richiede.
      throw new AccountLockedError(user.lockedUntil as Date);
    }

    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) {
      // Un lockout scaduto (locked_until nel passato, non piu' "attivo" per
      // isLocked() sopra) non deve far ripartire il contatore da dove era
      // rimasto: altrimenti un solo tentativo sbagliato dopo la scadenza
      // riblocherebbe subito l'account per un'altra finestra intera.
      if (user.lockedUntil !== null) {
        await this.users.resetFailedLoginAttempts(user.id);
      }
      const { lockedUntil } = await this.users.incrementFailedLoginAttempts(
        user.id,
        MAX_FAILED_LOGIN_ATTEMPTS,
        new Date(Date.now() + LOCKOUT_DURATION_MS)
      );
      if (lockedUntil !== null) {
        throw new AccountLockedError(lockedUntil);
      }
      throw new InvalidCredentialsError();
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.users.resetFailedLoginAttempts(user.id);
    }
    return this.buildResponse(user);
  }

  private async buildResponse(user: UserRecord): Promise<AuthResponse> {
    const token = await this.tokens.sign({ sub: user.id, email: user.email });
    return { token, user: toPublicUser(user) };
  }
}

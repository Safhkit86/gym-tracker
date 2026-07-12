import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from "@gym-tracker/shared";
import { EmailAlreadyInUseError, InvalidCredentialsError } from "../errors.js";
import type { UserRecord, UserRepository } from "../repositories/user-repository.js";
import type { PasswordHasher } from "./password.js";
import type { TokenService } from "./token.js";

/** Normalizza l'email per confronto/unicita' (case-insensitive). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
    private readonly tokens: TokenService
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

    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) {
      throw new InvalidCredentialsError();
    }

    return this.buildResponse(user);
  }

  private async buildResponse(user: UserRecord): Promise<AuthResponse> {
    const token = await this.tokens.sign({ sub: user.id, email: user.email });
    return { token, user: toPublicUser(user) };
  }
}

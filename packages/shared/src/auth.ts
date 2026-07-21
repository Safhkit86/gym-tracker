import { SignJWT, jwtVerify } from "jose";

/** Proiezione pubblica di un utente: mai esposto il password hash. */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface RequestPasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ConfirmPasswordChangeRequest {
  otp: string;
}

/** Risposta generica (nessun dato sensibile) per forgot/reset/change password. */
export interface MessageResponse {
  message: string;
}

/** Risposta di register/login: token di accesso + utente pubblico. */
export interface AuthResponse {
  token: string;
  user: PublicUser;
}

/** Claim del JWT di accesso emesso da auth-service. */
export interface AuthTokenClaims {
  /** id utente (subject) */
  sub: string;
  email: string;
}

/** Lanciata quando un access token e' assente/invalido/scaduto. */
export class TokenVerificationError extends Error {
  constructor(message = "Token non valido o scaduto.") {
    super(message);
    this.name = "TokenVerificationError";
  }
}

/**
 * Firma e verifica degli access token. Vive in shared perche' il formato del
 * token e' un contratto tra i servizi: auth-service lo emette, tutti gli altri
 * lo verificano. Cosi' la logica (algoritmo, claim, scadenza) sta in un posto solo.
 */
export interface AccessTokenService {
  sign(claims: AuthTokenClaims): Promise<string>;
  verify(token: string): Promise<AuthTokenClaims>;
}

export function createAccessTokenService(
  secret: string,
  options: { expiresIn?: string } = {}
): AccessTokenService {
  const key = new TextEncoder().encode(secret);
  const expiresIn = options.expiresIn ?? "1h";

  return {
    async sign(claims: AuthTokenClaims): Promise<string> {
      return new SignJWT({ email: claims.email })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);
    },
    async verify(token: string): Promise<AuthTokenClaims> {
      try {
        const { payload } = await jwtVerify(token, key);
        if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
          throw new TokenVerificationError("Token privo dei claim richiesti.");
        }
        return { sub: payload.sub, email: payload.email };
      } catch (err) {
        if (err instanceof TokenVerificationError) {
          throw err;
        }
        throw new TokenVerificationError();
      }
    },
  };
}

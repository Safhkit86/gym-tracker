import { SignJWT, jwtVerify } from "jose";
import type { AuthTokenClaims } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";

/**
 * Firma/verifica dei JWT di accesso, iniettabile nell'app cosi' i test
 * possono usare un segreto fisso senza dipendere dalla config d'ambiente.
 */
export interface TokenService {
  sign(claims: AuthTokenClaims): Promise<string>;
  verify(token: string): Promise<AuthTokenClaims>;
}

export interface JoseTokenServiceOptions {
  secret: string;
  /** Durata del token, formato jose (es. "1h", "7d"). Default "1h". */
  expiresIn?: string;
}

export function createJoseTokenService({
  secret,
  expiresIn = "1h",
}: JoseTokenServiceOptions): TokenService {
  const key = new TextEncoder().encode(secret);

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
          throw new UnauthorizedError("Token privo dei claim richiesti.");
        }
        return { sub: payload.sub, email: payload.email };
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          throw err;
        }
        throw new UnauthorizedError("Token non valido o scaduto.");
      }
    },
  };
}

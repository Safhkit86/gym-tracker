import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AccessTokenService, AuthTokenClaims } from "@gym-tracker/shared";
import { extractAuthToken, TokenVerificationError } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Claim del token verificato; presente solo dopo `authenticate`. */
      userClaims?: AuthTokenClaims;
    }
  }
}

/**
 * Verifica il token (Bearer, app mobile, o cookie httpOnly, webapp — vedi
 * extractAuthToken) emesso da account-service, verificato qui con lo
 * stesso AccessTokenService condiviso, e popola `req.userClaims`.
 */
export function authenticate(tokens: AccessTokenService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractAuthToken(req);
      if (!token) {
        throw new UnauthorizedError("Autenticazione mancante (Bearer o cookie).");
      }
      req.userClaims = await tokens.verify(token);
      next();
    } catch (err) {
      next(err instanceof TokenVerificationError ? new UnauthorizedError(err.message) : err);
    }
  };
}

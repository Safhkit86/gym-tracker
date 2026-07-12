import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AuthTokenClaims } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { TokenService } from "../domain/token.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Claim del token verificato; presente solo dopo `authenticate`. */
      userClaims?: AuthTokenClaims;
    }
  }
}

/** Estrae il token da "Authorization: Bearer <token>". */
function extractBearer(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

/**
 * Verifica il Bearer JWT e popola `req.userClaims`.
 * Delega l'errore all'error handler tramite `next`.
 */
export function authenticate(tokens: TokenService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractBearer(req.header("authorization"));
      if (!token) {
        throw new UnauthorizedError("Header Authorization Bearer mancante.");
      }
      req.userClaims = await tokens.verify(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}

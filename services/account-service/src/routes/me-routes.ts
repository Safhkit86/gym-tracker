import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService, AuthResponse, PublicUser } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { UserRepository } from "../repositories/user-repository.js";
import type { PasswordChangeService } from "../domain/password-change-service.js";
import { authenticate } from "../middleware/authenticate.js";

const changeRequestSchema = z.object({
  currentPassword: z.string().min(1, "Password attuale mancante."),
  newPassword: z.string().min(8, "La password deve avere almeno 8 caratteri."),
});

const changeConfirmSchema = z.object({
  otp: z.string().min(1, "Codice mancante."),
});

/** Rotte del proprio account: profilo e cambio password (autenticato). */
export function createMeRoutes(
  users: UserRepository,
  tokens: AccessTokenService,
  passwordChangeService: PasswordChangeService
): Router {
  const router = Router();

  router.get("/me", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }

      const user = await users.findById(claims.sub);
      if (!user) {
        // Token valido ma utente inesistente (es. cancellato): non autorizzato.
        throw new UnauthorizedError("Utente non trovato.");
      }

      const body: PublicUser = {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  // Rinnova il token corrente (stesso utente, nuova scadenza): richiede un
  // Bearer ancora valido, quindi funziona solo se chiamato PRIMA che scada
  // (sessione "a scorrimento" — vedi apps/web e apps/mobile, LogSessionPage/
  // LogSessionScreen, l'unico punto che lo richiama periodicamente finche'
  // resta aperto, dato che una sessione di allenamento puo' durare piu' di
  // un'ora, oltre la scadenza fissa del token). Nessun refresh token
  // separato: la firma JWT e' stateless, "rinnovare" significa solo
  // riemettere lo stesso claim con una nuova scadenza.
  router.post("/me/token/refresh", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }

      const user = await users.findById(claims.sub);
      if (!user) {
        throw new UnauthorizedError("Utente non trovato.");
      }

      const newToken = await tokens.sign({ sub: user.id, email: user.email });
      const body: AuthResponse = {
        token: newToken,
        user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post("/me/password/change-request", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }
      const body = changeRequestSchema.parse(req.body);
      const result = await passwordChangeService.requestChange(
        claims.sub,
        body.currentPassword,
        body.newPassword
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/me/password/change-confirm", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }
      const body = changeConfirmSchema.parse(req.body);
      const result = await passwordChangeService.confirmChange(claims.sub, body.otp);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

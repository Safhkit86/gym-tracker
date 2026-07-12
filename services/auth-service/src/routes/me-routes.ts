import { Router } from "express";
import type { PublicUser } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { TokenService } from "../domain/token.js";
import type { UserRepository } from "../repositories/user-repository.js";
import { authenticate } from "../middleware/authenticate.js";

/** Rotta protetta di esempio: restituisce l'utente autenticato. */
export function createMeRoutes(users: UserRepository, tokens: TokenService): Router {
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

  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../domain/auth-service.js";

const credentialsSchema = z.object({
  // Trim prima di validare: la normalizzazione (lowercase) avviene nel dominio.
  email: z.string().trim().email("Email non valida."),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri."),
});

/** Rotte pubbliche di autenticazione: registrazione e login. */
export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const body = credentialsSchema.parse(req.body);
      const result = await authService.register(body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const body = credentialsSchema.parse(req.body);
      const result = await authService.login(body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import { z } from "zod";
import { clearAuthCookie, setAuthCookie } from "@gym-tracker/shared";
import type { AuthService } from "../domain/auth-service.js";
import type { PasswordResetService } from "../domain/password-reset-service.js";

const credentialsSchema = z.object({
  // Trim prima di validare: la normalizzazione (lowercase) avviene nel dominio.
  email: z.string().trim().email("Email non valida."),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri."),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email non valida."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token mancante."),
  newPassword: z.string().min(8, "La password deve avere almeno 8 caratteri."),
});

/**
 * Rotte pubbliche di autenticazione: registrazione, login, reset password.
 * Montate per intero come pubbliche dal gateway (vedi api-gateway/src/app.ts),
 * corretto per queste rotte: nessuna richiede una sessione esistente.
 */
export function createAuthRoutes(
  authService: AuthService,
  passwordResetService: PasswordResetService
): Router {
  const router = Router();

  // setAuthCookie in aggiunta (non in sostituzione) al token nel body JSON:
  // l'app mobile continua a leggerlo di li' e a mandarlo come Bearer
  // (nessun cookie jar utile su React Native), la webapp smette di
  // leggerlo dal body e si affida al cookie httpOnly — vedi AuthProvider.tsx.
  router.post("/register", async (req, res, next) => {
    try {
      const body = credentialsSchema.parse(req.body);
      const result = await authService.register(body);
      setAuthCookie(res, result.token);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const body = credentialsSchema.parse(req.body);
      const result = await authService.login(body);
      setAuthCookie(res, result.token);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Un cookie httpOnly non e' leggibile/cancellabile da JS: senza questa
  // rotta il "logout" lato client (svuotare lo stato React) non basterebbe
  // a invalidarlo, resterebbe valido fino alla scadenza naturale (1h).
  // Pubblica (nessun authenticate): idempotente anche senza una sessione
  // valida, la webapp la chiama sempre al logout senza doverlo verificare
  // prima. Mai chiamata dall'app mobile (nessun cookie da cancellare li').
  router.post("/logout", (_req, res) => {
    clearAuthCookie(res);
    res.status(204).send();
  });

  router.post("/forgot-password", async (req, res, next) => {
    try {
      const body = forgotPasswordSchema.parse(req.body);
      const result = await passwordResetService.forgotPassword(body.email);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    try {
      const body = resetPasswordSchema.parse(req.body);
      const result = await passwordResetService.resetPassword(body.token, body.newPassword);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

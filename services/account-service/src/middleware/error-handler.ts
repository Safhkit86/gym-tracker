import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import type { ApiError } from "@gym-tracker/shared";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

function fromZodError(err: ZodError): ApiError {
  const issues = err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return {
    code: "VALIDATION_ERROR",
    // Il messaggio del primo issue e' gia' scritto per l'utente (vedi i
    // messaggi custom nelle zod schema delle rotte): mostrarlo com'e' invece
    // di un generico "dati non validi" e' l'unico modo per far arrivare
    // all'utente QUALE campo non va bene.
    message: issues[0]?.message ?? "Dati della richiesta non validi.",
    details: { issues },
  };
}

/**
 * Traduce gli errori in una risposta `ApiError` coerente.
 * Va registrato per ultimo, dopo tutte le rotte.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // Express riconosce un error handler dai 4 parametri: `next` va dichiarato.
  _next: NextFunction
): void => {
  if (err instanceof ZodError) {
    res.status(400).json(fromZodError(err));
    return;
  }

  if (err instanceof AppError) {
    const body: ApiError = { code: err.code, message: err.message };
    if (err.details) {
      body.details = err.details;
    }
    res.status(err.status).json(body);
    return;
  }

  req.log.error({ err }, "errore non gestito");
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Errore interno del server.",
  } satisfies ApiError);
};

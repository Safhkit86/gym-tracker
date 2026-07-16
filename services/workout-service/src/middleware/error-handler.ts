import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import type { ApiError } from "@gym-tracker/shared";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

function fromZodError(err: ZodError): ApiError {
  return {
    code: "VALIDATION_ERROR",
    message: "Dati della richiesta non validi.",
    details: {
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
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

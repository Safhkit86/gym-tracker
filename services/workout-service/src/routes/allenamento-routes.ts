import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService } from "@gym-tracker/shared";
import { authenticate } from "../middleware/authenticate.js";
import { UnauthorizedError } from "../errors.js";
import type { AllenamentoService } from "../domain/allenamento-service.js";

const createSchema = z.object({
  name: z.string().trim().min(1, "Il nome dell'allenamento e' obbligatorio."),
});

// Entrambi i campi opzionali e indipendenti (vedi UpdateAllenamentoRequest
// in @gym-tracker/shared): la rotta applica solo quelli presenti, ma ne
// serve almeno uno (altrimenti la richiesta non farebbe nulla).
const updateSchema = z
  .object({
    name: z.string().trim().min(1, "Il nome dell'allenamento e' obbligatorio.").optional(),
    isActive: z.literal(true).optional(),
  })
  .refine((body) => body.name !== undefined || body.isActive !== undefined, {
    message: "Serve almeno uno tra name e isActive.",
  });

/** Rotte degli allenamenti (gruppi di schede). */
export function createAllenamentoRoutes(
  allenamenti: AllenamentoService,
  tokens: AccessTokenService
): Router {
  const router = Router();
  router.use(authenticate(tokens));

  function userId(req: { userClaims?: { sub: string } }): string {
    const id = req.userClaims?.sub;
    if (!id) {
      throw new UnauthorizedError();
    }
    return id;
  }

  router.get("/allenamenti", async (req, res, next) => {
    try {
      const list = await allenamenti.list(userId(req));
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  });

  router.post("/allenamenti", async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const created = await allenamenti.create(userId(req), body.name);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/allenamenti/:id", async (req, res, next) => {
    try {
      const body = updateSchema.parse(req.body);
      const uid = userId(req);
      let result = body.name ? await allenamenti.rename(uid, req.params.id, body.name) : null;
      if (body.isActive) {
        result = await allenamenti.setActive(uid, req.params.id);
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/allenamenti/:id", async (req, res, next) => {
    try {
      await allenamenti.delete(userId(req), req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

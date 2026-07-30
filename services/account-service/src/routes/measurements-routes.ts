import { Router } from "express";
import { z } from "zod";
import type { AccessTokenService, UserMeasurements } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { UserMeasurementsRepository } from "../repositories/user-measurements-repository.js";
import {
  EMPTY_CACHED_MEASUREMENTS,
  type MeasurementCacheRepository,
} from "../repositories/measurement-cache-repository.js";
import type { MeasurementEventPublisher } from "../events/measurement-events-publisher.js";
import { authenticate } from "../middleware/authenticate.js";

// Bound larghi di sanita' (fat-finger, non un vincolo clinico): tutti opzionali.
const measurementsSchema = z.object({
  heightCm: z.number().positive().max(250).nullish(),
  weightKg: z.number().positive().max(400).nullish(),
  chestCm: z.number().positive().max(300).nullish(),
  armCm: z.number().positive().max(300).nullish(),
  waistCm: z.number().positive().max(300).nullish(),
  legCm: z.number().positive().max(300).nullish(),
  /** Solo se l'utente ha scelto una data diversa da oggi (toggle "Storicizza
   *  le misure" attivo); assente => oggi. */
  measuredOn: z.string().date().optional(),
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Misure fisiche dell'atleta (Profilo > Misure atleta). `heightCm' e' l'unico
 * valore letto/scritto localmente; peso/petto/braccia/vita/gamba non hanno
 * copia locale: il salvataggio pubblica `measurement-save-requested` (publish
 * confermato, vedi events/measurement-events-publisher.ts) verso
 * history-service, e la lettura usa la cache Redis alimentata da
 * `measurement-recorded` (cache-miss => null sui 5 campi, mai un errore: lo
 * storico reale resta intatto in Storico > Misure).
 */
export function createMeasurementsRoutes(
  measurements: UserMeasurementsRepository,
  measurementCache: MeasurementCacheRepository,
  measurementEventPublisher: MeasurementEventPublisher,
  tokens: AccessTokenService
): Router {
  const router = Router();

  router.get("/me/measurements", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }
      const [height, cached] = await Promise.all([
        measurements.find(claims.sub),
        measurementCache.get(claims.sub),
      ]);
      const record: UserMeasurements = {
        heightCm: height.heightCm,
        ...(cached ?? EMPTY_CACHED_MEASUREMENTS),
      };
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.put("/me/measurements", authenticate(tokens), async (req, res, next) => {
    try {
      const claims = req.userClaims;
      if (!claims) {
        throw new UnauthorizedError();
      }
      const body = measurementsSchema.parse(req.body);
      const height = await measurements.upsert(claims.sub, { heightCm: body.heightCm ?? null });

      const weightKg = body.weightKg ?? null;
      const chestCm = body.chestCm ?? null;
      const armCm = body.armCm ?? null;
      const waistCm = body.waistCm ?? null;
      const legCm = body.legCm ?? null;

      // Publish confermato: nessuna copia locale di questi 5 campi, quindi
      // un fallimento qui deve far fallire la richiesta (l'utente riprova),
      // non essere ignorato in log come i publish best-effort altrove.
      await measurementEventPublisher.publishMeasurementSaveRequested({
        userId: claims.sub,
        measuredOn: body.measuredOn ?? today(),
        weightKg,
        chestCm,
        armCm,
        waistCm,
        legCm,
      });

      // Risponde con esattamente i valori appena inviati: nessun bisogno di
      // rileggere la cache, stessa esperienza sincrona di prima dello split.
      const record: UserMeasurements = {
        heightCm: height.heightCm,
        weightKg,
        chestCm,
        armCm,
        waistCm,
        legCm,
      };
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

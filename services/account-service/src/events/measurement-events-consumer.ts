import { z } from "zod";
import {
  startReliableConsumer,
  MEASUREMENT_RECORDED_QUEUE,
  type Logger,
  type ReliableConsumer,
  type MeasurementRecordedEvent,
} from "@gym-tracker/shared";
import type { MeasurementCacheRepository } from "../repositories/measurement-cache-repository.js";

const measurementRecordedEventSchema = z.object({
  userId: z.string().uuid(),
  weightKg: z.number().nullable(),
  chestCm: z.number().nullable(),
  armCm: z.number().nullable(),
  waistCm: z.number().nullable(),
  legCm: z.number().nullable(),
});

export function parseMeasurementRecordedEvent(raw: Buffer): MeasurementRecordedEvent {
  return measurementRecordedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface MeasurementEventsConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  measurementCache: MeasurementCacheRepository;
}

/**
 * Aggiorna la cache Redis di lettura veloce dopo che history-service ha
 * confermato l'upsert. Non e' la scrittura primaria (quella e' gia' avvenuta
 * in `measurement_entries`): un fallimento qui degrada solo la UX di
 * `GET /me/measurements` (torna a leggere null sui 5 campi finche' non
 * arriva un salvataggio successivo), non i dati.
 */
export async function handleMeasurementRecorded(
  event: MeasurementRecordedEvent,
  deps: MeasurementEventsConsumerDeps
): Promise<void> {
  await deps.measurementCache.set(event.userId, {
    weightKg: event.weightKg,
    chestCm: event.chestCm,
    armCm: event.armCm,
    waistCm: event.waistCm,
    legCm: event.legCm,
  });
}

export interface MeasurementEventsConsumer {
  close(): Promise<void>;
}

export async function startMeasurementEventsConsumer(
  deps: MeasurementEventsConsumerDeps
): Promise<MeasurementEventsConsumer> {
  const consumer: ReliableConsumer = await startReliableConsumer({
    connectionUrl: deps.connectionUrl,
    queueName: MEASUREMENT_RECORDED_QUEUE,
    logger: deps.logger,
    parseMessage: parseMeasurementRecordedEvent,
    handle: (event) => handleMeasurementRecorded(event, deps),
  });

  return {
    close: () => consumer.close(),
  };
}

import { z } from "zod";
import {
  startReliableConsumer,
  MEASUREMENT_SAVE_REQUESTED_QUEUE,
  type Logger,
  type ReliableConsumer,
  type MeasurementSaveRequestedEvent,
} from "@gym-tracker/shared";
import type { MeasurementEntryRepository } from "../repositories/measurement-entry-repository.js";
import type { MeasurementEventPublisher } from "./measurement-events-publisher.js";

const measurementSaveRequestedEventSchema = z.object({
  userId: z.string().uuid(),
  measuredOn: z.string(),
  weightKg: z.number().nullable(),
  chestCm: z.number().nullable(),
  armCm: z.number().nullable(),
  waistCm: z.number().nullable(),
  legCm: z.number().nullable(),
});

export function parseMeasurementSaveRequestedEvent(raw: Buffer): MeasurementSaveRequestedEvent {
  return measurementSaveRequestedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface MeasurementEventsConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  measurementEntries: MeasurementEntryRepository;
  publisher: MeasurementEventPublisher;
}

/**
 * A differenza di `handleSessionLogged` (best-effort, la scrittura primaria e'
 * gia' avvenuta), qui l'upsert IN QUESTO consumer e' la scrittura primaria di
 * peso/petto/braccia/vita/gamba: account-service non ne tiene copia locale
 * (vedi measurement-events-publisher.ts in account-service, publish
 * confermato). Se l'upsert fallisce l'eccezione propaga e
 * `startReliableConsumer` applica retry/backoff/dead-letter come per
 * qualunque altro fallimento transitorio.
 */
export async function handleMeasurementSaveRequested(
  event: MeasurementSaveRequestedEvent,
  deps: MeasurementEventsConsumerDeps
): Promise<void> {
  await deps.measurementEntries.upsert(event.userId, event.measuredOn, {
    weightKg: event.weightKg,
    chestCm: event.chestCm,
    armCm: event.armCm,
    waistCm: event.waistCm,
    legCm: event.legCm,
  });

  try {
    await deps.publisher.publishMeasurementRecorded({
      userId: event.userId,
      weightKg: event.weightKg,
      chestCm: event.chestCm,
      armCm: event.armCm,
      waistCm: event.waistCm,
      legCm: event.legCm,
    });
  } catch (err) {
    // Best-effort: l'upsert e' gia' andato a buon fine, un fallimento di
    // publish qui degrada solo la cache Redis di account-service (torna a
    // leggere null finche' non arriva un salvataggio successivo).
    deps.logger.error({ err }, "pubblicazione di measurement-recorded fallita");
  }
}

export interface MeasurementEventsConsumer {
  close(): Promise<void>;
}

export async function startMeasurementEventsConsumer(
  deps: MeasurementEventsConsumerDeps
): Promise<MeasurementEventsConsumer> {
  const consumer: ReliableConsumer = await startReliableConsumer({
    connectionUrl: deps.connectionUrl,
    queueName: MEASUREMENT_SAVE_REQUESTED_QUEUE,
    logger: deps.logger,
    parseMessage: parseMeasurementSaveRequestedEvent,
    handle: (event) => handleMeasurementSaveRequested(event, deps),
  });

  return {
    close: () => consumer.close(),
  };
}

import type { Redis } from "ioredis";

/** Ultime misure storicizzate note (peso/petto/braccia/vita/gamba), lette
 *  velocemente senza andare su history-service. Pura cache di lettura: mai
 *  scritta otticamente da account-service, solo alimentata consumando
 *  `measurement-recorded` (vedi events/measurement-events-consumer.ts). */
export interface CachedMeasurements {
  weightKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
}

export const EMPTY_CACHED_MEASUREMENTS: CachedMeasurements = {
  weightKg: null,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
};

export interface MeasurementCacheRepository {
  /** null se mai scritta o scaduta (TTL, riavvio Redis): degrado accettato,
   *  lo storico reale vive comunque in history-service, mai in questa cache. */
  get(userId: string): Promise<CachedMeasurements | null>;
  set(userId: string, values: CachedMeasurements): Promise<void>;
}

function cacheKey(userId: string): string {
  return `measurements:${userId}`;
}

/** E' pur sempre una cache, non l'unica fonte di verita': un TTL generoso ma
 *  non infinito basta, un cache-miss torna semplicemente null. */
const TTL_SECONDS = 30 * 24 * 60 * 60;

/** Implementazione reale su Redis (ioredis). */
export class RedisMeasurementCacheRepository implements MeasurementCacheRepository {
  constructor(private readonly redis: Redis) {}

  async get(userId: string): Promise<CachedMeasurements | null> {
    const raw = await this.redis.get(cacheKey(userId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CachedMeasurements;
  }

  async set(userId: string, values: CachedMeasurements): Promise<void> {
    await this.redis.set(cacheKey(userId), JSON.stringify(values), "EX", TTL_SECONDS);
  }
}

/** Implementazione in memoria: usata nei test per evitare un Redis reale. */
export class InMemoryMeasurementCacheRepository implements MeasurementCacheRepository {
  private readonly byUserId = new Map<string, CachedMeasurements>();

  async get(userId: string): Promise<CachedMeasurements | null> {
    return this.byUserId.get(userId) ?? null;
  }

  async set(userId: string, values: CachedMeasurements): Promise<void> {
    this.byUserId.set(userId, values);
  }
}

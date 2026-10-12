import type { Logger } from "@gym-tracker/shared";
import { UnauthorizedError } from "../errors.js";
import type { UserRepository } from "../repositories/user-repository.js";
import type { UserMeasurementsRepository } from "../repositories/user-measurements-repository.js";
import type { AccountPreferencesRepository } from "../repositories/account-preferences-repository.js";
import type { AccountDeletionEventPublisher } from "../events/account-deletion-publisher.js";

/**
 * Esportazione dati (diritto alla portabilita', GDPR): solo i dati che
 * account-service possiede davvero. Un export davvero completo (schede,
 * sessioni, notifiche, suggerimenti di progressione) richiederebbe
 * account-service a chiamare via HTTP gli altri servizi direttamente — un
 * pattern mai usato in questo progetto (solo gateway-verso-servizio o
 * eventi RabbitMQ asincroni, vedi "Cosa NON fare" in CLAUDE.md), quindi non
 * introdotto qui. Il resto dei dati dell'utente e' gia' leggibile dal
 * client via le rotte esistenti (GET /workouts, /sessions, /measurements,
 * /notifications, ecc.): l'export completo lato client le aggrega, vedi
 * apps/web/src/api/export-account-data.ts.
 */
export interface AccountDataExport {
  profile: {
    id: string;
    email: string;
    createdAt: string;
  };
  measurements: {
    heightCm: number | null;
  };
  accountPreferences: {
    prefillScope: string;
    timerSoundEnabled: boolean;
    historicizeMeasurements: boolean;
  };
}

/**
 * Cancellazione account (diritto all'oblio, GDPR). La cancellazione in
 * account-service e' la scrittura primaria e deve riuscire perche' la
 * richiesta HTTP riesca; il fan-out agli altri servizi (vedi
 * AccountDeletionEventPublisher) e' best-effort, stesso trattamento di
 * SessionLoggedEvent/SessionDeletedEvent altrove nel progetto — un
 * fallimento di publish viene loggato ma non fa fallire DELETE /me: i dati
 * dell'utente in account-service sono comunque spariti, che è l'esito che
 * l'utente si aspetta chiamando questa rotta.
 */
export class AccountDeletionService {
  constructor(
    private readonly users: UserRepository,
    private readonly measurements: UserMeasurementsRepository,
    private readonly accountPreferences: AccountPreferencesRepository,
    private readonly eventPublisher: AccountDeletionEventPublisher,
    private readonly logger: Logger
  ) {}

  async exportAccountData(userId: string): Promise<AccountDataExport> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Utente non trovato.");
    }
    const [measurements, preferences] = await Promise.all([
      this.measurements.find(userId),
      this.accountPreferences.find(userId),
    ]);
    return {
      profile: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
      measurements,
      accountPreferences: preferences,
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Utente non trovato.");
    }

    // Espliciti anche se la FK ON DELETE CASCADE farebbe lo stesso lavoro
    // sul DB reale (vedi commento nei due repository): rende il comportamento
    // identico, e verificabile, anche con le implementazioni in memoria.
    await this.measurements.delete(userId);
    await this.accountPreferences.delete(userId);
    await this.users.deleteById(userId);

    try {
      await this.eventPublisher.publishUserDeleted({ userId });
    } catch (err) {
      this.logger.error(
        { err, userId },
        "publish di user-deleted fallito: i dati in workout/history/progress/notify-service " +
          "non verranno puliti automaticamente, serve intervento manuale"
      );
    }
  }
}

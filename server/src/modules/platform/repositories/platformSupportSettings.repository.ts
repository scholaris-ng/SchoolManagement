import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { PlatformSupportSettings } from '../entities/platformSupportSettings.entity';

/**
 * A single row: the platform has exactly one support WhatsApp number, not one
 * per anything else. `get` reads the oldest row rather than assuming there can
 * only ever be one, in case a race ever created a second.
 */
export class PlatformSupportSettingsRepository {
  static Instance = new PlatformSupportSettingsRepository();

  private readonly repo = AppDataSource.getRepository(PlatformSupportSettings);

  private constructor() {}

  async get(): Promise<PlatformSupportSettings | null> {
    return this.repo.findOne({ where: {}, order: { createdAt: 'ASC' } });
  }

  async setWhatsappNumber(whatsappNumber: string, updatedBy: string): Promise<PlatformSupportSettings> {
    const existing = await this.get();
    if (existing) {
      existing.whatsappNumber = whatsappNumber;
      existing.updatedBy = updatedBy;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ whatsappNumber, updatedBy }));
  }
}

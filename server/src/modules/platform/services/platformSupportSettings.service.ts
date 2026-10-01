import { PlatformSupportSettingsRepository } from '../repositories/platformSupportSettings.repository';
import type { PlatformSupportSettingsDTO } from '../dto/platform.dto';

/**
 * The one WhatsApp number the in-app support widget sends to. Set by a
 * platform administrator; read by every signed-in user, since the widget
 * itself is visible to every persona.
 */
export class PlatformSupportSettingsService {
  static Instance = new PlatformSupportSettingsService();

  private constructor(private readonly settings = PlatformSupportSettingsRepository.Instance) {}

  async get(): Promise<PlatformSupportSettingsDTO> {
    const row = await this.settings.get();
    return { whatsappNumber: row?.whatsappNumber ?? null };
  }

  async update(whatsappNumber: string, updatedBy: string): Promise<PlatformSupportSettingsDTO> {
    const row = await this.settings.setWhatsappNumber(whatsappNumber, updatedBy);
    return { whatsappNumber: row.whatsappNumber };
  }
}

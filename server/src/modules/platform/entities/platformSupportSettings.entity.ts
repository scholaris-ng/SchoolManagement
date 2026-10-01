import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';

/**
 * The WhatsApp number the in-app support widget sends to, as a `wa.me` link
 * the sender's own browser opens — a single row, since the platform has
 * exactly one. `whatsappNumber` null means the widget stays hidden: nothing
 * to send to yet.
 */
@Entity('platform_support_settings')
export class PlatformSupportSettings extends BaseEntity {
  @Column({ name: 'whatsapp_number', type: 'varchar', length: 32, nullable: true })
  whatsappNumber: string | null;

  /** The platform administrator's email, for whoever asks who last changed it. */
  @Column({ name: 'updated_by', type: 'varchar', length: 160, nullable: true })
  updatedBy: string | null;
}

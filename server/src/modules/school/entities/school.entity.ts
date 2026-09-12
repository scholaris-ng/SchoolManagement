import { Column, Entity, Index, VersionColumn } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';

export interface SchoolBranding {
  primaryColor: string;
  accentColor: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  motto?: string | null;
}

export interface SchoolSettings {
  timezone: string;
  currency: string;
  currencySymbol: string;
  country: string;
  locale: string;
  requirePhotoConsent: boolean;
  absenceAlertEnabled: boolean;
  absenceAlertCutoff: string;
  resultPublishNotification: boolean;
  allowParentTeacherMessaging: boolean;
}

/** The tenant. Every other business table hangs off this row's id. */
@Entity('schools')
export class School extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', name: 'short_name', length: 60 })
  shortName: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  code: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', name: 'address_line1', length: 200 })
  addressLine1: string;

  @Column({ type: 'varchar', name: 'address_line2', length: 200, nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 80 })
  city: string;

  @Column({ type: 'varchar', length: 80 })
  state: string;

  // Genuinely dynamic presentation and policy configuration, which is what
  // spec section 42 permits jsonb for — not relational data hidden in a blob.
  @Column({ type: 'jsonb' })
  branding: SchoolBranding;

  @Column({ type: 'jsonb' })
  settings: SchoolSettings;

  @Column({ type: 'varchar', length: 20, default: 'TRIAL' })
  @Index()
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

  /**
   * Optimistic lock (spec section 34). Two administrators editing branding at
   * once must not silently overwrite each other; the client sends the value it
   * loaded as `If-Match`.
   */
  @VersionColumn()
  version: number;
}

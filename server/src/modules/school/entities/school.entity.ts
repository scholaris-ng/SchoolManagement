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
  /**
   * Birthday SMS to each pupil's guardian on the day. Optional: schools created
   * before the feature existed have no value, and absent reads as off — no
   * school starts paying for messages it never switched on.
   */
  birthdaySmsEnabled?: boolean;
  /** `HH:mm`, school-local. Absent means `DEFAULT_BIRTHDAY_SMS_SEND_TIME`. */
  birthdaySmsSendTime?: string;
  /** Placeholders per `smsTemplate.ts`; null or absent means the built-in wording. */
  birthdaySmsTemplate?: string | null;
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

  /** `TRIAL` until someone activates the school, `ACTIVE` after. Whether it can be *used* is `accessEndsAt`. */
  @Column({ type: 'varchar', length: 20, default: 'TRIAL' })
  @Index()
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

  /**
   * The moment the software stops working for this school: 14 days after it was
   * created, and pushed back a month at a time by an activation. The default
   * starts every school's trial however it was created — see the migration.
   */
  @Column({
    type: 'timestamptz',
    name: 'access_ends_at',
    default: () => "now() + interval '14 days'",
  })
  accessEndsAt: Date;

  @Column({ type: 'timestamptz', name: 'last_activated_at', nullable: true })
  lastActivatedAt: Date | null;

  /** The administrator's email address, as it was when they activated. */
  @Column({ type: 'varchar', name: 'last_activated_by', length: 160, nullable: true })
  lastActivatedBy: string | null;

  /**
   * Prepaid SMS credit, in message pages. Topped up by a platform
   * administrator (`/platform/schools/:id/sms-credits`), spent by the send
   * path one page at a time. Every movement is in `sms_credit_entries`.
   */
  @Column({ name: 'sms_credits', type: 'int', default: 0 })
  smsCredits: number;

  /**
   * Naira left over from a top-up that didn't divide evenly by the SMS unit
   * price (₦100 at ₦8/page buys 12 pages with ₦4 to spare). Folded into the
   * next top-up rather than discarded — see `SmsCreditRepository.topUp`.
   */
  @Column({ name: 'sms_credit_remainder_ngn', type: 'numeric', precision: 10, scale: 2, default: 0 })
  smsCreditRemainderNgn: string;

  /**
   * Optimistic lock (spec section 34). Two administrators editing branding at
   * once must not silently overwrite each other; the client sends the value it
   * loaded as `If-Match`.
   */
  @VersionColumn()
  version: number;
}

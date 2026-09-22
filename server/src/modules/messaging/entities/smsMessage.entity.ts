import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Guardian } from '../../guardians/entities/guardian.entity';

/**
 * Why a text message was sent. Add a value here for each new kind of message
 * the server learns to send; the list is what the log screen filters on.
 */
export const SMS_PURPOSES = ['STUDENT_BIRTHDAY', 'TEST'] as const;
export type SmsPurpose = (typeof SMS_PURPOSES)[number];

/**
 * `FAILED` covers both a refusal from the gateway and a message that could not
 * be attempted at all — no usable number, no provider configured. The error
 * message says which.
 */
export type SmsStatus = 'QUEUED' | 'SENT' | 'FAILED';

/**
 * Every text message the server has tried to send, whatever it was for.
 *
 * SMS costs money per message, so each one is written down before it goes and
 * updated with the gateway's answer afterwards: an office asking "did the
 * Okoros get their reminder?" gets a real answer, and the bill can be
 * reconciled against this table. `dedupeKey` is what makes a resend safe —
 * a job that runs twice in one day (a restart, a manual re-run) inserts the
 * same key, hits the unique index, and sends nothing a second time.
 */
@Entity('sms_messages')
@Index(['schoolId', 'createdAt'])
@Index(['schoolId', 'purpose', 'createdAt'])
export class SmsMessage extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 40 })
  purpose: SmsPurpose;

  /** As sent to the gateway (international digits), or as found on the record when it could not be normalised. */
  @Column({ name: 'recipient_phone', type: 'varchar', length: 40 })
  recipientPhone: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 160, nullable: true })
  recipientName: string | null;

  /** The pupil the message is about, when there is one. */
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  @Index()
  studentId: string | null;

  @ManyToOne(() => Student, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  @Column({ name: 'guardian_id', type: 'uuid', nullable: true })
  guardianId: string | null;

  @ManyToOne(() => Guardian, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'guardian_id' })
  guardian?: Guardian | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 12, default: 'QUEUED' })
  status: SmsStatus;

  /** `kudisms` today. Kept per row so a later provider change leaves history readable. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  provider: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 120, nullable: true })
  providerMessageId: string | null;

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse: unknown;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /** Unique when set — see the class comment. Null for a one-off message nobody will repeat. */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 160, nullable: true, unique: true })
  dedupeKey: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /** Who pressed the button, when a person did; null for the scheduler. */
  @Column({ name: 'triggered_by_user_id', type: 'uuid', nullable: true })
  triggeredByUserId: string | null;
}

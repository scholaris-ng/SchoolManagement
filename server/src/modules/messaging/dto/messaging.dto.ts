import type { SmsPurpose, SmsStatus } from '../entities/smsMessage.entity';

/** One row of the SMS log, as the client lists it. */
export interface SmsMessageDTO {
  id: string;
  schoolId: string;
  purpose: SmsPurpose;
  recipientPhone: string;
  recipientName: string | null;
  studentId: string | null;
  studentName: string | null;
  guardianId: string | null;
  body: string;
  status: SmsStatus;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

/** What one birthday run did for one school. */
export interface BirthdayRunSummaryDTO {
  schoolId: string;
  /** The school-local calendar date the run was for, `YYYY-MM-DD`. */
  date: string;
  /** Pupils whose birthday it is. */
  celebrants: number;
  sent: number;
  failed: number;
  /** Already greeted earlier today — a second run never re-sends. */
  alreadySent: number;
  /** Nobody on the pupil's record has a usable number. */
  noRecipient: number;
  /** Not sent because the school's SMS credit ran out part way through. */
  noCredit: number;
  /** The school's balance once the run had finished, in message pages. */
  creditsLeft: number;
  /** Why nothing was attempted at all, when nothing was. */
  skippedReason: 'SMS_NOT_CONFIGURED' | 'NO_CREDIT' | 'DISABLED' | null;
}

export interface SmsStatusDTO {
  configured: boolean;
  provider: string | null;
  senderId: string | null;
  /** This school's prepaid credit, in message pages. */
  credits: number;
  /** Naira per SMS page, so the screen can say what the credit is worth. */
  unitPriceNgn: number;
  /** Who to ask for more: the platform administrator, when one is configured. */
  topUpContact: string | null;
}

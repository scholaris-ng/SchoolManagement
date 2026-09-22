import type { SmsCreditEntryDTO } from '../../messaging/repositories/smsCredit.repository';

/** One school on the platform, as the Schools screen lists it. Mirrors `PlatformSchool` on the client. */
export interface PlatformSchoolDTO {
  id: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  plan: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  /** ISO timestamp of the moment the school's access ends. */
  endsAt: string;
  expired: boolean;
  daysLeft: number;
  lastActivatedAt: string | null;
  lastActivatedBy: string | null;
  /** Prepaid SMS credit, in message pages. */
  smsCredits: number;
  createdAt: string;
}

/**
 * The platform's own standing with the SMS gateway, against what it has
 * promised to schools. `gatewayBalance` is in the gateway's units (KudiSMS
 * reports units, one per page); `promisedCredits` is every school's unused
 * balance added up. The first should cover the second.
 */
export interface PlatformSmsStatusDTO {
  configured: boolean;
  provider: string | null;
  senderId: string | null;
  missing: string[];
  /** Naira per SMS page, as charged to schools. */
  unitPriceNgn: number;
  gatewayBalance: number | null;
  gatewayError: string | null;
  promisedCredits: number;
}

/** A school's SMS credit as the platform screen shows it: the balance, and how it got there. */
export interface SchoolSmsCreditsDTO {
  schoolId: string;
  schoolName: string;
  balance: number;
  unitPriceNgn: number;
  entries: SmsCreditEntryDTO[];
}

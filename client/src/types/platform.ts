/** One school on the platform, as the Schools screen lists it. Mirrors `PlatformSchoolDTO` on the server. */
export interface PlatformSchool {
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

export type SmsCreditEntryType = 'TOPUP' | 'DEBIT' | 'REFUND' | 'ADJUSTMENT';

/** One movement of a school's SMS credit. `units` is signed. */
export interface SmsCreditEntry {
  id: string;
  type: SmsCreditEntryType;
  units: number;
  balanceAfter: number;
  /** For a top-up: naira paid and the price per page then. */
  amountNgn: number | null;
  unitPriceNgn: number | null;
  note: string | null;
  smsMessageId: string | null;
  actorName: string | null;
  createdAt: string;
}

/**
 * The platform's standing with the SMS gateway against what it has promised
 * schools. `gatewayBalance` should cover `promisedCredits`.
 */
export interface PlatformSmsStatus {
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

/** A school's SMS credit: the balance, and the most recent movements. */
export interface SchoolSmsCredits {
  schoolId: string;
  schoolName: string;
  balance: number;
  unitPriceNgn: number;
  entries: SmsCreditEntry[];
}

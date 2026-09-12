import { http } from '@/lib/http';
import type { VerificationResult } from '@/types/results';
import type { CalendarEvent } from '@/types/curriculum';
import type { NewsPost, WebsiteContent } from '@/types/engagement';
import type { SchoolBranding } from '@/types/tenant';
import type { PublicAdmissionOptions, PublicApplicationReceipt, PublicOffer } from '@/types/admissions';

/**
 * Endpoint layer for the unauthenticated routes.
 *
 * These are the only routes that answer without a session, so they return
 * deliberately thin payloads — enough to prove a document is genuine or to
 * render a marketing page, never a child's record (spec sections 22 and 31).
 */

export interface PublicSchoolPage {
  school: {
    name: string;
    shortName: string;
    branding: SchoolBranding;
    city: string;
    state: string;
  };
  website: WebsiteContent;
  news: NewsPost[];
  events: CalendarEvent[];
}

/** The body the public application form posts. */
export interface PublicApplicationPayload {
  applicantType: 'GUARDIAN' | 'SELF';
  sessionId: string;
  applicants: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  consentGiven: true;
}

export const PublicEndpoints = {
  verify: (code: string) => http.get<VerificationResult>(`/public/verify/${code}`),

  fetchSchoolPage: (slug: string) => http.get<PublicSchoolPage>(`/public/schools/${slug}`),

  /** The sessions and classes this school is currently taking applications for. */
  fetchAdmissionOptions: (slug: string) =>
    http.get<PublicAdmissionOptions>(`/public/schools/${slug}/admissions`),

  /**
   * The only unauthenticated write in the API. It creates applications and
   * nothing else — no account, and no guardian record for whoever filled the
   * form in. That happens when the school enrols the child.
   */
  submitApplication: (slug: string, payload: PublicApplicationPayload) =>
    http.post<PublicApplicationReceipt>(`/public/schools/${slug}/applications`, payload),

  /** What the "respond to this offer" link shows, by its token alone. */
  fetchOffer: (token: string) => http.get<PublicOffer>(`/public/offers/${token}`),

  /** The family accepting or declining a place, with no account of their own. */
  respondToOffer: (token: string, action: 'ACCEPT' | 'DECLINE') =>
    http.post<PublicOffer>(`/public/offers/${token}/respond`, { action }),
};

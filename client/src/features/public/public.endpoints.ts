import { http } from '@/lib/http';
import type { VerificationResult } from '@/types/results';
import type { CalendarEvent } from '@/types/curriculum';
import type { NewsPost, WebsiteContent } from '@/types/engagement';
import type { SchoolBranding } from '@/types/tenant';

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

export const PublicEndpoints = {
  verify: (code: string) => http.get<VerificationResult>(`/public/verify/${code}`),

  fetchSchoolPage: (slug: string) => http.get<PublicSchoolPage>(`/public/schools/${slug}`),
};

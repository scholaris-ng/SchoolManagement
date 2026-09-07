import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import type { VerificationResult } from '@/types/results';
import type { CalendarEvent } from '@/types/curriculum';
import type { NewsPost, WebsiteContent } from '@/types/engagement';
import type { SchoolBranding } from '@/types/tenant';

/**
 * Unauthenticated endpoints.
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

export function useVerification(code: string | undefined) {
  return useQuery({
    queryKey: queryKeys.public.verification(code ?? ''),
    queryFn: () => http.get<VerificationResult>(`/public/verify/${code}`),
    enabled: Boolean(code),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function usePublicSchool(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.public.website(slug ?? ''),
    queryFn: () => http.get<PublicSchoolPage>(`/public/schools/${slug}`),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

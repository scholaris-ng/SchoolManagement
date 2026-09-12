import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PublicEndpoints } from './public.endpoints';
import type { PublicApplicationPayload, PublicSchoolPage } from './public.endpoints';

export type { PublicSchoolPage };

export function useVerification(code: string | undefined) {
  return useQuery({
    queryKey: queryKeys.public.verification(code ?? ''),
    queryFn: () => PublicEndpoints.verify(code ?? ''),
    enabled: Boolean(code),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function usePublicSchool(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.public.website(slug ?? ''),
    queryFn: () => PublicEndpoints.fetchSchoolPage(slug ?? ''),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 5 * 60_000,
    // The site layout renders its own "not available" state for this one — a
    // visitor landing on an unpublished or unknown address should see that,
    // not a system-style toast (query-client.ts).
    meta: { silent: true },
  });
}

/**
 * What the school's application form may offer.
 *
 * Kept apart from the prospectus above because it changes on a different
 * clock: a school opening or closing admissions should take effect for the
 * next visitor, while its copy and photographs can sit in a cache far longer.
 */
export function usePublicAdmissionOptions(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.public.admissionOptions(slug ?? ''),
    queryFn: () => PublicEndpoints.fetchAdmissionOptions(slug ?? ''),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 60_000,
    // A school that has not published a page at all is not an error worth
    // shouting about on a marketing site; the form falls back to writing to
    // the office instead.
    meta: { silent: true },
  });
}

/**
 * Submitting an application from the public site.
 *
 * No cache to invalidate — this visitor has no session and will never read the
 * admissions list. The receipt it resolves with is the whole result, and the
 * form renders it as the confirmation the family keeps.
 */
export function useSubmitApplication(slug: string | undefined) {
  return useMutation({
    mutationFn: (payload: PublicApplicationPayload) =>
      PublicEndpoints.submitApplication(slug ?? '', payload),
    meta: { silent: true },
  });
}

/** The "respond to this offer" link's own page reads this by its token alone. */
export function useOffer(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.public.offer(token ?? ''),
    queryFn: () => PublicEndpoints.fetchOffer(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    meta: { silent: true },
  });
}

/** Accepting or declining a place, with no account of the family's own. */
export function useRespondToOffer(token: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: 'ACCEPT' | 'DECLINE') =>
      PublicEndpoints.respondToOffer(token ?? '', action),
    meta: { silent: true },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.public.offer(token ?? ''), result);
    },
  });
}

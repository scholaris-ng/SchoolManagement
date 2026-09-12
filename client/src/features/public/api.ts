import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PublicEndpoints } from './public.endpoints';
import type { PublicSchoolPage } from './public.endpoints';

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

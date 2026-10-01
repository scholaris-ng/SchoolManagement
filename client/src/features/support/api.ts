import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/app/providers/auth-provider';
import { SupportEndpoints } from './support.endpoints';

/** Rarely changes, so a long staleTime avoids a round trip on every page the widget mounts on. */
export function useSupportSettings() {
  const { status } = useAuth();
  return useQuery({
    queryKey: queryKeys.platform.supportSettings(),
    queryFn: SupportEndpoints.fetchSettings,
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, isApiError } from './api-error';
import { toast } from './toast-bus';

/**
 * One QueryClient for the app, with retry/staleness policy chosen for schools
 * on unreliable connections: retry the things worth retrying, never retry a
 * 4xx, and keep data usable while it revalidates.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (isApiError(error) && !error.isRetryable) return false;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      },
      mutations: {
        // Mutations are not retried automatically: a duplicated POST could
        // create a second student or a second payment. The offline queue
        // handles deliberate, idempotent replay instead.
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Background refetch failures stay quiet; only surface the first load.
        if (query.state.data !== undefined) return;
        if (isApiError(error) && (error.isUnauthenticated || error.isOffline)) return;
        toast.error(describeError(error));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isApiError(error) && error.isUnauthenticated) return;
        // Version conflicts are handled by the calling feature with a dialog.
        if (isApiError(error) && error.isVersionConflict) return;
        toast.error(describeError(error));
      },
    }),
  });
}

function describeError(error: unknown): string {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : 'Something went wrong.';
  }
  const apiError = error as ApiError;
  if (apiError.isForbidden) return 'You do not have permission to do that.';
  if (apiError.isOffline) return 'You are offline. We will retry when the connection returns.';
  if (apiError.status >= 500) return 'The server had a problem. Please try again shortly.';
  return apiError.message;
}

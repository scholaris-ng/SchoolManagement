import { Compass } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { isApiError } from '@/lib/api-error';

/**
 * What a visitor sees instead of the header/template/footer scaffold when
 * there is no real page behind this address — no such school, or one that
 * has not published its site yet. Falling through to the shipped default
 * content here would look like a real, if generic, school website; this
 * exists so unpublished never gets mistaken for published (spec section 31).
 */
export function SiteUnavailable({ error }: { error: unknown }) {
  const notFound = isApiError(error) && error.isNotFound;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      {notFound ? (
        <EmptyState
          icon={<Compass />}
          title="This website isn't available"
          description="There's no published site at this address. If this is your school, check that it's published under Administration → Website."
          data-cy="site-unavailable"
        />
      ) : (
        <ErrorState error={error} data-cy="site-unavailable" />
      )}
    </div>
  );
}

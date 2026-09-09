import { Link, useLocation } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Compass />}
        title="We could not find that page"
        description={`Nothing lives at ${location.pathname}. It may have been moved, or the link that brought you here may be out of date.`}
        action={
          <Button data-cy="errors-not-found-back-to-the-dashboard" asChild>
            <Link to="/">
              <Home />
              Back to the dashboard
            </Link>
          </Button>
        }
      />
    </div>
  );
}

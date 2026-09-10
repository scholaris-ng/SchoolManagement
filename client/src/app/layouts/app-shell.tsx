import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { localStore, storageKeys } from '@/lib/storage';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useOutbox, useOutboxRuntime } from '@/hooks/use-outbox';
import { useUnreadCounts } from '@/features/notifications/api';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { LoadingState } from '@/components/ui/feedback';
import { OfflineBanner } from '@/components/layout/offline-banner';

/**
 * The authenticated application frame: permanent sidebar on desktop, a slide-in
 * drawer on mobile, and a persistent top bar carrying search, sync state and
 * notifications.
 */
export function AppShell() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [collapsed, setCollapsed] = useState(() =>
    localStore.get(storageKeys.sidebarCollapsed, false),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useOutboxRuntime();
  const { pendingCount } = useOutbox();
  const counts = useUnreadCounts();

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  // Move focus to the main region on route change so screen-reader and
  // keyboard users are not left at the bottom of the previous page.
  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      localStore.set(storageKeys.sidebarCollapsed, !current);
      return !current;
    });
  };

  const badges = {
    messages: counts.data?.messages ?? 0,
    notifications: counts.data?.notifications ?? 0,
    outbox: pendingCount,
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Skip to main content
      </a>

      {isDesktop && (
        <aside className="sticky top-0 h-dvh shrink-0 no-print">
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            badges={badges}
          />
        </aside>
      )}

      <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-64 outline-none data-[state=open]:animate-slide-in-right lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <div className="relative h-full">
              <DialogPrimitive.Close
                className="absolute right-2 top-3 z-10 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
              <Sidebar
                collapsed={false}
                onToggleCollapsed={toggleCollapsed}
                onNavigate={() => setMobileNavOpen(false)}
                badges={badges}
                className="h-full"
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className={cn('flex min-w-0 flex-1 flex-col')}>
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <OfflineBanner />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <Suspense fallback={<LoadingState label="Loading page…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

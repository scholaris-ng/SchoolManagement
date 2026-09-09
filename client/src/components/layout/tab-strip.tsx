import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Home } from 'lucide-react';

export interface TabDefinition {
  id: string;
  label: string;
  icon?: typeof Home;
  count?: number;
}

/**
 * In-page tabs whose selection lives in the URL.
 *
 * Unlike `PageTabs` — which navigates between routes — this switches panels
 * inside a single screen while still producing a shareable, refresh-safe and
 * back-button-friendly address ("send me the finance view of the analytics
 * page"). The first tab is the default and is left out of the query string.
 */
export function useTabState(tabs: TabDefinition[], paramName = 'tab') {
  const [params, setParams] = useSearchParams();
  const requested = params.get(paramName);
  const active = tabs.find((tab) => tab.id === requested) ?? tabs[0];

  const setActive = (tabId: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (tabId === tabs[0]?.id) next.delete(paramName);
        else next.set(paramName, tabId);
        return next;
      },
      { replace: true },
    );
  };

  return { activeId: active?.id, setActive };
}

export function TabStrip({
  tabs,
  activeId,
  onChange,
  label,
  className,
}: {
  tabs: TabDefinition[];
  activeId: string | undefined;
  onChange: (tabId: string) => void;
  /** Names the tablist for screen readers, e.g. "Analytics sections". */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('scrollbar-thin -mb-px overflow-x-auto border-b border-border', className)}>
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              data-cy={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
                selected
                  ? 'text-primary after:bg-primary'
                  : 'text-muted-foreground after:bg-transparent hover:text-foreground',
              )}
            >
              {tab.icon && <tab.icon className="size-4" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The panel a `TabStrip` controls. */
export function TabPanel({
  tabId,
  children,
  className,
}: {
  tabId: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      tabIndex={0}
      className={cn('outline-none', className)}
    >
      {children}
    </div>
  );
}

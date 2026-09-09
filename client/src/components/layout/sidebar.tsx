import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronsLeft, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, type NavItem } from '@/app/navigation';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/feedback';
import { SchoolSwitcher } from './school-switcher';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
  badges?: Partial<Record<NonNullable<NavItem['badgeKey']>, number>>;
  className?: string;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  badges = {},
  className,
}: SidebarProps) {
  const { can, persona, membership } = useAuth();
  const { pathname } = useLocation();

  // Sections are filtered once per permission change rather than per render of
  // every link, and an entirely empty section disappears rather than showing a
  // bare heading.
  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            (!item.personas || item.personas.includes(persona)) && (!item.require || can(item.require)),
        ),
      })).filter(
        (section) =>
          section.items.length > 0 && (!section.personas || section.personas.includes(persona)),
      ),
    [can, persona],
  );

  /**
   * Several entries share a path prefix with another entry of their own
   * (`/analytics` and `/analytics/retention`, `/finance` and `/finance/fees`,
   * `/results` and `/results/entry`…). React Router's own `isActive` is
   * computed per-link, so both light up whenever the more specific one is
   * open. Pick a single winner sidebar-wide instead: whichever matching entry
   * has the longest `to` is the one actually on screen.
   */
  const activeTo = useMemo(() => {
    let best: NavItem | null = null;
    for (const section of sections) {
      for (const item of section.items) {
        const isMatch = item.end
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
        if (isMatch && (!best || item.to.length > best.to.length)) best = item;
      }
    }
    return best?.to ?? null;
  }, [sections, pathname]);

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-border bg-card',
        collapsed ? 'w-[4.5rem]' : 'w-64',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2 border-b border-border px-3',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-4" aria-hidden="true" />
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">
              {membership?.schoolShortName ?? 'Scholaris'}
            </p>
            <p className="truncate text-xs text-muted-foreground">School management</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-border p-3">
          <SchoolSwitcher />
        </div>
      )}

      <nav
        className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3"
        aria-label="Main navigation"
      >
        {sections.map((section) => (
          <div key={section.id} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                const isActive = item.to === activeTo;
                const link = (
                  <NavLink
                    to={item.to}
                    data-cy={`nav-${item.to.replace(/^\//, '').replace(/\//g, '-') || 'home'}`}
                    // Only the sidebar-wide winner may report itself active; every
                    // other entry is forced to an exact match (which the current
                    // path can't satisfy, or it would have won) so React Router
                    // doesn't also mark a less-specific ancestor as current.
                    end={isActive ? item.end : true}
                    onClick={onNavigate}
                    className={() =>
                      cn(
                        'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-2',
                        isActive
                          ? 'bg-primary-subtle text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {!collapsed && badge !== undefined && badge > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {collapsed && badge !== undefined && badge > 0 && (
                      <span className="absolute right-2 top-1.5 size-2 rounded-full bg-primary" />
                    )}
                  </NavLink>
                );

                return (
                  <li key={item.to} className="relative">
                    {collapsed ? (
                      <Tooltip content={item.label} side="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="hidden shrink-0 border-t border-border p-2 lg:block">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          data-cy="sidebar-toggle"
          onClick={onToggleCollapsed}
          className={cn('text-muted-foreground', !collapsed && 'w-full justify-start')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeft className={cn('transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </div>
  );
}

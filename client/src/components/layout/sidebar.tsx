import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronsLeft, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { localStore, storageKeys } from '@/lib/storage';
import { NAV_SECTIONS, isNavItemVisible, type NavItem } from '@/app/navigation';
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

/** A section this small has nothing worth hiding, so it starts open. */
const SMALL_SECTION_ITEMS = 2;

/**
 * Which sections the person has opened or closed themselves, by id. Anything
 * not in here follows the defaults, so a section added in a later release
 * needs no migration, and a malformed value costs a preference, not the menu.
 */
function readChoices(): Record<string, boolean> {
  const stored = localStore.get<unknown>(storageKeys.sidebarSections, {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  badges = {},
  className,
}: SidebarProps) {
  const { can, persona, membership, user } = useAuth();
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
            (!item.personas || item.personas.includes(persona)) &&
            (!item.require || can(item.require)) &&
            isNavItemVisible(item, user),
        ),
      })).filter(
        (section) =>
          section.items.length > 0 && (!section.personas || section.personas.includes(persona)),
      ),
    [can, persona, user],
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

  const activeSectionId = useMemo(
    () => sections.find((section) => section.items.some((item) => item.to === activeTo))?.id ?? null,
    [sections, activeTo],
  );

  const [choices, setChoices] = useState(readChoices);

  useEffect(() => {
    localStore.set(storageKeys.sidebarSections, choices);
  }, [choices]);

  // Arriving somewhere — a link on a dashboard, the command palette, a
  // bookmark — opens the section it lives in, even one the person had closed.
  // Only on arriving: closing the section you are standing in stays closed.
  useEffect(() => {
    if (!activeSectionId) return;
    setChoices((current) => {
      if (current[activeSectionId] !== false) return current;
      const { [activeSectionId]: _closed, ...rest } = current;
      return rest;
    });
  }, [activeSectionId]);

  /**
   * Closed unless the person opened it, they are inside it, or it is the first
   * section or a tiny one. The icon-only rail has no headings to fold under,
   * so it always lists everything.
   */
  const isOpen = (section: (typeof sections)[number], index: number): boolean => {
    if (collapsed) return true;
    const chosen = choices[section.id];
    if (chosen !== undefined) return chosen;
    return (
      section.id === activeSectionId || index === 0 || section.items.length <= SMALL_SECTION_ITEMS
    );
  };

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
        {sections.map((section, index) => {
          const open = isOpen(section, index);
          const listId = `nav-list-${section.id}`;
          // A closed section must not swallow news: an unread message is still
          // visible from the heading, and so is "you are in here".
          const unread = section.items.reduce(
            (total, item) => total + (item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0),
            0,
          );

          return (
            <div key={section.id} className={cn(open ? 'mb-4' : 'mb-1', 'last:mb-0')}>
              {!collapsed && (
                <button
                  type="button"
                  data-cy={`nav-group-${section.id}`}
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => setChoices((current) => ({ ...current, [section.id]: !open }))}
                  className="flex w-full items-center gap-1.5 rounded-md px-3 pb-1.5 pt-1 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  {!open && unread > 0 && (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold normal-case tabular-nums text-primary-foreground">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {!open && unread === 0 && section.id === activeSectionId && (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Current section" />
                  )}
                  <ChevronRight
                    className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
                    aria-hidden="true"
                  />
                </button>
              )}
              <ul id={listId} hidden={!open} className="space-y-0.5">
                {section.items.map((item) => {
                  const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                  const isActive = item.to === activeTo;
                  const link = (
                    <NavLink
                      to={item.to}
                      // The rail drops the text beside the icon, so without this
                      // the link has no name at all for a screen reader — the
                      // tooltip only appears on hover. An unread count is only a
                      // dot there, so it goes into the name too.
                      aria-label={
                        collapsed
                          ? badge !== undefined && badge > 0
                            ? `${item.label} (${badge})`
                            : item.label
                          : undefined
                      }
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
                            ? // White in dark mode: on the pale, near-white tint
                              // `bg-primary-subtle` resolves to in light mode,
                              // `text-primary` blue is what reads there, but that
                              // same class resolves to a dark navy tint in dark
                              // mode, where blue text looks muted next to plain
                              // white — the override applies only where it's
                              // wanted.
                              'bg-primary-subtle text-primary dark:text-white'
                            : cn(
                                'text-muted-foreground hover:bg-accent hover:text-foreground',
                                // Collapsed, there is no label next to the icon to
                                // carry the eye, so `muted-foreground`'s already-low
                                // contrast against the dark card background reads as
                                // barely-there. Expanded, the label supplies that
                                // contrast, so this override is collapsed-only.
                                collapsed && 'dark:text-white/80',
                              ),
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
          );
        })}
      </nav>

      <div className="hidden shrink-0 border-t border-border p-2 lg:block">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          data-cy="sidebar-toggle"
          onClick={onToggleCollapsed}
          className={cn(
            'text-muted-foreground',
            collapsed && 'dark:text-white/80',
            !collapsed && 'w-full justify-start',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeft className={cn('transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </div>
  );
}

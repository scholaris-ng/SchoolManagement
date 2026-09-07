import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { membershipLabel } from '@/lib/permissions';

/**
 * Tenant switcher. A user who works at two schools (or a group owner managing
 * several) picks one here; every query key and API call is scoped to it.
 */
export function SchoolSwitcher({ compact }: { compact?: boolean }) {
  const { memberships, membership, switchSchool } = useAuth();

  if (!membership) return null;

  // With a single membership there is nothing to switch between — show the
  // school as a static label rather than a menu that does nothing.
  if (memberships.length <= 1) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2',
          compact && 'border-0 bg-transparent px-0',
        )}
      >
        <SchoolMark
          name={membership.schoolShortName}
          logoUrl={membership.branding.logoUrl}
          color={membership.branding.primaryColor}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{membership.schoolName}</p>
          <p className="truncate text-xs text-muted-foreground">{membershipLabel(membership)}</p>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Switch school"
      >
        <SchoolMark
          name={membership.schoolShortName}
          logoUrl={membership.branding.logoUrl}
          color={membership.branding.primaryColor}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{membership.schoolName}</p>
          <p className="truncate text-xs text-muted-foreground">{membershipLabel(membership)}</p>
        </div>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-1 shadow-popover animate-in"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your schools
          </DropdownMenu.Label>
          {memberships.map((entry) => (
            <DropdownMenu.Item
              key={entry.schoolId}
              onSelect={() => switchSchool(entry.schoolId)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent"
            >
              <SchoolMark
                name={entry.schoolShortName}
                logoUrl={entry.branding.logoUrl}
                color={entry.branding.primaryColor}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{entry.schoolName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {membershipLabel(entry)}
                  {entry.branchName ? ` · ${entry.branchName}` : ''}
                </p>
              </div>
              {entry.schoolId === membership.schoolId && (
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SchoolMark({
  name,
  logoUrl,
  color,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-8 shrink-0 rounded-md object-contain"
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
      style={{ backgroundColor: color ?? '#4f46e5' }}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase() || <Building2 className="size-4" />}
    </span>
  );
}

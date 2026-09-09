import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/format';
import type { ParentChildSummary } from '@/types/analytics';
import { Avatar } from '@/components/ui/primitives';

/**
 * The child switcher.
 *
 * Rendered as a horizontal strip of cards rather than a dropdown: a parent with
 * three children should see all three, including which one has an unpaid bill,
 * without opening anything (spec section 8).
 */
export function ChildSwitcher({
  children,
  activeChildId,
  onSelect,
  currency,
}: {
  children: ParentChildSummary[];
  activeChildId: string | null;
  onSelect: (studentId: string) => void;
  currency: string;
}) {
  if (children.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Choose a child"
      className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {children.map((child) => {
        const active = child.studentId === activeChildId;
        return (
          <button
            data-cy="family-child-switcher-present-child-outstandingbalance-0"
            key={child.studentId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(child.studentId)}
            className={cn(
              'flex min-w-[13rem] shrink-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-primary bg-primary-subtle'
                : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
            )}
          >
            <Avatar name={child.fullName} src={child.photoUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{child.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {child.className ?? 'No class'} · {formatPercent(child.attendanceRate, 0)} present
              </p>
              {child.outstandingBalance > 0 && (
                <p className="truncate text-xs font-medium text-warning">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 0,
                  }).format(child.outstandingBalance)}{' '}
                  outstanding
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

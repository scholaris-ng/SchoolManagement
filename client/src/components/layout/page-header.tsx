import { Link, NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/primitives';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.to && !isLast ? (
                <Link to={item.to} className="rounded transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast && 'font-medium text-foreground')} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="size-3 shrink-0" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  meta?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  tabs,
  meta,
  loading,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {loading ? (
            <Skeleton className="h-7 w-56" />
          ) : (
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
          )}
          {description &&
            (loading ? (
              <Skeleton className="h-4 w-72" />
            ) : (
              <p className="text-sm text-muted-foreground">{description}</p>
            ))}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}

/** Standard page wrapper: consistent max width, gutters and vertical rhythm. */
export function PageContainer({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  width?: 'default' | 'narrow' | 'wide';
}) {
  const widths = {
    narrow: 'max-w-3xl',
    default: 'max-w-7xl',
    wide: 'max-w-none',
  };
  return (
    <div className={cn('mx-auto w-full space-y-6 px-4 py-5 sm:px-6 lg:py-6', widths[width], className)}>
      {children}
    </div>
  );
}

/** Horizontal tab strip built on NavLinks so every tab is deep-linkable. */
export function PageTabs({
  items,
}: {
  items: { label: string; to: string; count?: number; end?: boolean }[];
}) {
  return (
    <div className="scrollbar-thin -mb-px overflow-x-auto border-b border-border">
      <nav className="flex min-w-max gap-1" aria-label="Sections">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
                isActive
                  ? 'text-primary after:bg-primary'
                  : 'text-muted-foreground after:bg-transparent hover:text-foreground',
              )
            }
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {item.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

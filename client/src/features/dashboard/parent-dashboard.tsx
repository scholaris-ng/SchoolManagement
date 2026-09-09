import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Heart,
  MessageSquare,
  Receipt,
  ScrollText,
  Trophy,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { ordinal } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useParentDashboard } from './api';
import { useActiveChild } from '@/features/family/use-active-child';
import { ChildSwitcher } from '@/features/family/child-switcher';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * The parent dashboard.
 *
 * Its job is to answer, in one screen, the four questions a parent actually
 * has: is my child attending, how are they doing, do I owe anything, and has
 * the school said anything to me (spec section 53).
 */
export function ParentDashboard() {
  const { user } = useAuth();
  const dashboard = useParentDashboard();
  const data = dashboard.data;
  const currency = data?.currency ?? 'NGN';

  const { activeChild, activeChildId, setActiveChildId, children } = useActiveChild(data?.children);

  if (dashboard.isError) {
    return (
      <PageContainer>
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  const firstName = user?.displayName?.split(' ').slice(-1)[0] ?? 'there';
  const totalOutstanding = children.reduce((sum, child) => sum + child.outstandingBalance, 0);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={
          children.length === 0
            ? 'Your children will appear here once the school links them to your account.'
            : `You are following ${children.length} ${children.length === 1 ? 'child' : 'children'} at this school.`
        }
        actions={
          <Button data-cy="parent-dashboard-message-the-school" variant="outline" asChild>
            <Link to="/messages">
              <MessageSquare />
              Message the school
            </Link>
          </Button>
        }
      />

      {dashboard.isPending ? (
        <LoadingState label="Loading your children…" />
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title="No children linked to your account yet"
          description="Ask the school office to link your children to this email address. Once they do, everything will appear here."
        />
      ) : (
        <>
          <ChildSwitcher
            children={children}
            activeChildId={activeChildId}
            onSelect={setActiveChildId}
            currency={currency}
          />

          {activeChild && (
            <>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4 pt-5">
                  <Avatar name={activeChild.fullName} src={activeChild.photoUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{activeChild.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {activeChild.admissionNo}
                      {activeChild.className ? ` · ${activeChild.className}` : ''}
                    </p>
                    {activeChild.resultPublished && (
                      <Badge tone="success" className="mt-1.5">
                        This term&rsquo;s result is available
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button data-cy="parent-dashboard-full-profile" variant="outline" asChild>
                      <Link to={`/family/${activeChild.studentId}`}>
                        <ScrollText />
                        Full profile
                      </Link>
                    </Button>
                    <Button data-cy="parent-dashboard-fees" asChild>
                      <Link to="/family/finance">
                        <Wallet />
                        Fees
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Attendance this term"
                  value={formatPercent(activeChild.attendanceRate)}
                  icon={<ClipboardCheck />}
                  tone={activeChild.attendanceRate >= 90 ? 'success' : 'warning'}
                />
                <StatCard
                  label="Current average"
                  value={
                    activeChild.currentTermAverage !== null &&
                    activeChild.currentTermAverage !== undefined
                      ? formatPercent(activeChild.currentTermAverage)
                      : 'Not published'
                  }
                  hint={
                    activeChild.position && activeChild.classSize
                      ? `${ordinal(activeChild.position)} of ${activeChild.classSize}`
                      : 'Position is published with the report card'
                  }
                  icon={<ScrollText />}
                />
                <StatCard
                  label="Outstanding fees"
                  value={formatCurrency(activeChild.outstandingBalance, currency)}
                  icon={<Wallet />}
                  tone={activeChild.outstandingBalance > 0 ? 'danger' : 'success'}
                  to="/family/finance"
                />
                <StatCard
                  label="House points"
                  value={activeChild.housePoints}
                  icon={<Trophy />}
                  to="/houses"
                />
              </div>
            </>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>All your children</CardTitle>
                <CardDescription>
                  One row per child, so nothing gets missed while you are looking at another.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {children.map((child) => (
                    <li key={child.studentId} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={child.fullName} src={child.photoUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/family/${child.studentId}`}
                          className="truncate font-medium hover:text-primary hover:underline"
                        >
                          {child.fullName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {child.className ?? 'No class'} ·{' '}
                          {formatPercent(child.attendanceRate, 0)} attendance
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium tabular-nums ${
                            child.outstandingBalance > 0 ? 'text-danger' : 'text-success'
                          }`}
                        >
                          {child.outstandingBalance > 0
                            ? formatCurrency(child.outstandingBalance, currency)
                            : 'Paid up'}
                        </p>
                        {child.unreadMessages > 0 && (
                          <p className="text-xs text-primary">
                            {child.unreadMessages} unread message
                            {child.unreadMessages === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {totalOutstanding > 0 && (
                <Card className="border-warning/40 bg-warning-subtle">
                  <CardContent className="space-y-2 pt-5">
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(totalOutstanding, currency)} outstanding across your children
                    </p>
                    <Button data-cy="parent-dashboard-pay-school-fees" size="sm" asChild>
                      <Link to="/family/finance">
                        <CreditCard />
                        Pay school fees
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Recent payments</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(data?.recentPayments.length ?? 0) === 0 ? (
                    <EmptyState compact icon={<Receipt />} title="No payments recorded yet" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data?.recentPayments.slice(0, 5).map((payment) => (
                        <li key={payment.id} className="px-5 py-2.5 text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate">{payment.studentName}</span>
                            <span className="shrink-0 font-medium tabular-nums">
                              {formatCurrency(payment.amount, currency)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(payment.paidAt)}
                            {payment.receiptNo ? ` · receipt ${payment.receiptNo}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>School calendar</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(data?.upcomingEvents.length ?? 0) === 0 ? (
                    <EmptyState compact icon={<CalendarDays />} title="Nothing scheduled" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data?.upcomingEvents.slice(0, 5).map((event) => (
                        <li key={event.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                          <CalendarDays
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(event.startDate)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}

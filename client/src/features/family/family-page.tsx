import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Heart,
  MessageSquare,
  ScrollText,
  Shield,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatPercent, ordinal } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useParentDashboard } from '@/features/dashboard/api';
import { useActiveChild } from './use-active-child';
import { ChildSwitcher } from './child-switcher';
import { StudentAttendanceTab } from '@/features/students/tabs/attendance-tab';
import { StudentResultsTab } from '@/features/students/tabs/results-tab';
import { StudentBehaviourTab } from '@/features/students/tabs/behaviour-tab';
import { StudentFinanceTab } from '@/features/students/tabs/finance-tab';
import { StudentDocumentsTab } from '@/features/students/tabs/documents-tab';
import { StudentPickupTab } from '@/features/students/tabs/pickup-tab';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { TabPanel, TabStrip, useTabState, type TabDefinition } from '@/components/layout/tab-strip';
import { StatCard } from '@/components/data/stat-card';
import { Avatar, Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * The parent portal.
 *
 * A guardian signs in once and sees every child linked to them (spec section
 * 8). The child switcher is the only navigation that matters here: each panel
 * below reuses the same components staff see, scoped by the API to the children
 * this guardian is actually related to.
 */
export function FamilyPage() {
  const { studentId } = useParams<{ studentId?: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();

  const dashboard = useParentDashboard();
  const data = dashboard.data;
  const currency = data?.currency ?? 'NGN';

  const { children, activeChild, activeChildId, setActiveChildId } = useActiveChild(data?.children);

  // A deep link to one child wins over the remembered choice, but only if that
  // child really belongs to this guardian — the list came from the server.
  useEffect(() => {
    if (!studentId) return;
    if (children.some((child) => child.studentId === studentId)) setActiveChildId(studentId);
  }, [studentId, children, setActiveChildId]);

  const tabs = useMemo<TabDefinition[]>(() => {
    const all: (TabDefinition | null)[] = [
      can('attendance.read')
        ? { id: 'attendance', label: 'Attendance', icon: ClipboardCheck }
        : null,
      can('result.read') ? { id: 'results', label: 'Results', icon: ScrollText } : null,
      can('finance.read') ? { id: 'fees', label: 'Fees', icon: Wallet } : null,
      can('behaviour.read') ? { id: 'behaviour', label: 'Behaviour', icon: Sparkles } : null,
      { id: 'documents', label: 'Documents', icon: FileText },
      can('collection.read') ? { id: 'collection', label: 'Collection', icon: Shield } : null,
    ];
    return all.filter((tab): tab is TabDefinition => tab !== null);
  }, [can]);

  const { activeId, setActive } = useTabState(tabs);

  const headerActions = (
    <Button data-cy="family-message-the-school" variant="outline" asChild>
      <Link to="/messages">
        <MessageSquare />
        Message the school
      </Link>
    </Button>
  );

  if (dashboard.isError) {
    return (
      <PageContainer>
        <PageHeader
          title="My children"
          description="Everything about your children at this school, in one place."
          breadcrumbs={[{ label: 'Overview' }, { label: 'My children' }]}
          actions={headerActions}
        />
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  if (dashboard.isPending) {
    return (
      <PageContainer>
        <PageHeader
          title="My children"
          description="Everything about your children at this school, in one place."
          breadcrumbs={[{ label: 'Overview' }, { label: 'My children' }]}
          actions={headerActions}
        />
        <LoadingState label="Loading your children…" />
      </PageContainer>
    );
  }

  if (children.length === 0) {
    return (
      <PageContainer>
        <PageHeader
          title="My children"
          description="Everything about your children at this school, in one place."
          breadcrumbs={[{ label: 'Overview' }, { label: 'My children' }]}
          actions={headerActions}
        />
        <EmptyState
          icon={<Heart />}
          title="No children linked to your account yet"
          description="Ask the school office to link your children to this email address. Once they do, their attendance, results and fees appear here."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="My children"
        description={
          children.length === 1
            ? 'Attendance, results, fees and behaviour for your child.'
            : `Switch between your ${children.length} children — everything below follows your choice.`
        }
        breadcrumbs={[{ label: 'Overview' }, { label: 'My children' }]}
        actions={headerActions}
      />

      <ChildSwitcher
        children={children}
        activeChildId={activeChildId}
        onSelect={(id) => {
          setActiveChildId(id);
          // Keep the address bar honest so the view can be shared or bookmarked.
          navigate(`/family/${id}`, { replace: true });
        }}
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
              {activeChild.outstandingBalance > 0 && (
                <Button data-cy="family-pay-formatcurrency-activechild-outstandingbalance" asChild>
                  <Link to="/family/finance">
                    <Wallet />
                    Pay {formatCurrency(activeChild.outstandingBalance, currency, {
                      showDecimals: false,
                    })}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance this term"
              value={formatPercent(activeChild.attendanceRate)}
              tone={activeChild.attendanceRate >= 90 ? 'success' : 'warning'}
              icon={<ClipboardCheck />}
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
              tone={activeChild.outstandingBalance > 0 ? 'danger' : 'success'}
              to="/family/finance"
              icon={<Wallet />}
            />
            <StatCard
              label="House points"
              value={activeChild.housePoints}
              to="/houses"
              icon={<Trophy />}
            />
          </div>

          {tabs.length > 0 && (
            <>
              <TabStrip
                tabs={tabs}
                activeId={activeId}
                onChange={setActive}
                label={`Sections for ${activeChild.fullName}`}
              />

              <TabPanel tabId={activeId}>
                {/* Keyed by child so switching resets each panel's own term filter
                    rather than showing one child's term against another's data. */}
                {activeId === 'attendance' && (
                  <StudentAttendanceTab key={activeChild.studentId} studentId={activeChild.studentId} />
                )}
                {activeId === 'results' && (
                  <StudentResultsTab key={activeChild.studentId} studentId={activeChild.studentId} />
                )}
                {activeId === 'fees' && (
                  <StudentFinanceTab key={activeChild.studentId} studentId={activeChild.studentId} />
                )}
                {activeId === 'behaviour' && (
                  <StudentBehaviourTab key={activeChild.studentId} studentId={activeChild.studentId} />
                )}
                {activeId === 'documents' && (
                  <StudentDocumentsTab key={activeChild.studentId} studentId={activeChild.studentId} />
                )}
                {activeId === 'collection' && (
                  <StudentPickupTab key={activeChild.studentId} studentId={activeChild.studentId} />
                )}
              </TabPanel>
            </>
          )}
        </>
      )}

      {(data?.upcomingEvents.length ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-2 text-sm font-medium">Coming up at school</p>
            <ul className="divide-y divide-border">
              {data?.upcomingEvents.slice(0, 4).map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-2 text-sm">
                  <CalendarDays
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(event.startDate).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

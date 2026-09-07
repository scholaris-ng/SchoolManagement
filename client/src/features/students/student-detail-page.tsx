import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CreditCard,
  FileText,
  Heart,
  Pencil,
  ScrollText,
  Shield,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatPercent } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudent } from './api';
import { StudentOverviewTab } from './tabs/overview-tab';
import { StudentGuardiansTab } from './tabs/guardians-tab';
import { StudentAttendanceTab } from './tabs/attendance-tab';
import { StudentResultsTab } from './tabs/results-tab';
import { StudentFinanceTab } from './tabs/finance-tab';
import { StudentBehaviourTab } from './tabs/behaviour-tab';
import { StudentDocumentsTab } from './tabs/documents-tab';
import { StudentPickupTab } from './tabs/pickup-tab';
import { StudentStatusDialog } from './student-status-dialog';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/data/status-badge';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import type { PermissionRequirement } from '@/lib/permissions';

interface TabDefinition {
  id: string;
  label: string;
  icon: typeof Heart;
  require?: PermissionRequirement;
}

const TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', icon: UserCheck },
  { id: 'guardians', label: 'Guardians', icon: Heart, require: 'guardian.read' },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays, require: 'attendance.read' },
  { id: 'results', label: 'Results', icon: ScrollText, require: 'result.read' },
  { id: 'finance', label: 'Fees', icon: CreditCard, require: 'finance.read' },
  { id: 'behaviour', label: 'Behaviour', icon: Sparkles, require: 'behaviour.read' },
  { id: 'documents', label: 'Documents', icon: FileText, require: 'student.read' },
  { id: 'pickup', label: 'Collection', icon: Shield, require: 'collection.read' },
];

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const [statusOpen, setStatusOpen] = useState(false);

  const student = useStudent(id);
  const visibleTabs = TABS.filter((tab) => !tab.require || can(tab.require));
  const activeTab = params.get('tab') ?? 'overview';
  const currentTab = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];

  const setTab = (tabId: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (tabId === 'overview') next.delete('tab');
        else next.set('tab', tabId);
        return next;
      },
      { replace: true },
    );
  };

  if (student.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading student…" />
      </PageContainer>
    );
  }

  if (student.isError || !student.data) {
    return (
      <PageContainer>
        <ErrorState error={student.error} onRetry={() => void student.refetch()} />
      </PageContainer>
    );
  }

  const record = student.data;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Students', to: '/students' },
          { label: record.fullName },
        ]}
        title={
          <span className="flex items-center gap-3">
            <Avatar
              name={record.fullName}
              src={record.photoUrl}
              suppressPhoto={!record.photoConsent}
              size="lg"
              className="hidden sm:flex"
            />
            <span className="min-w-0">{record.fullName}</span>
          </span>
        }
        meta={
          <>
            <Badge tone="outline">{record.admissionNo}</Badge>
            {record.currentClassName && <Badge tone="primary">{record.currentClassName}</Badge>}
            {record.houseName && <Badge tone="neutral">{record.houseName} House</Badge>}
            <StatusBadge status={record.status} />
            <span className="text-xs text-muted-foreground">
              Admitted {formatDate(record.admissionDate)}
            </span>
          </>
        }
        actions={
          <>
            <PermissionGate require="student.update">
              <Button variant="outline" onClick={() => setStatusOpen(true)}>
                Change status
              </Button>
            </PermissionGate>
            <PermissionGate require="student.update">
              <Button asChild>
                <Link to={`/students/${record.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      <div className="scrollbar-thin -mb-px overflow-x-auto border-b border-border">
        <div role="tablist" aria-label="Student sections" className="flex min-w-max gap-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={currentTab?.id === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
                currentTab?.id === tab.id
                  ? 'text-primary after:bg-primary'
                  : 'text-muted-foreground after:bg-transparent hover:text-foreground',
              )}
            >
              <tab.icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${currentTab?.id}`}
        aria-labelledby={`tab-${currentTab?.id}`}
        tabIndex={0}
        className="outline-none"
      >
        {currentTab?.id === 'overview' && <StudentOverviewTab student={record} />}
        {currentTab?.id === 'guardians' && <StudentGuardiansTab studentId={record.id} />}
        {currentTab?.id === 'attendance' && <StudentAttendanceTab studentId={record.id} />}
        {currentTab?.id === 'results' && <StudentResultsTab studentId={record.id} />}
        {currentTab?.id === 'finance' && <StudentFinanceTab studentId={record.id} />}
        {currentTab?.id === 'behaviour' && <StudentBehaviourTab studentId={record.id} />}
        {currentTab?.id === 'documents' && <StudentDocumentsTab studentId={record.id} />}
        {currentTab?.id === 'pickup' && <StudentPickupTab studentId={record.id} />}
      </div>

      <StudentStatusDialog
        student={record}
        open={statusOpen}
        onOpenChange={setStatusOpen}
      />
    </PageContainer>
  );
}

/** Shared by several tabs: a labelled read-only value. */
export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 py-2', className)}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export { formatPercent };

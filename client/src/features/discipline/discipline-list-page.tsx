import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel, Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useListQuery } from '@/hooks/use-list-query';
import { useClasses } from '@/features/academics/api';
import { useIncidents } from './api';
import type { DisciplineIncident } from '@/types/behaviour';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/permission-gate';

const STATUS_OPTIONS = [
  { value: 'REPORTED', label: 'Reported' },
  { value: 'REFERRED', label: 'Referred' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'ACTION_TAKEN', label: 'Action taken' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const SEVERITY_OPTIONS = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'SEVERE', label: 'Severe' },
];

export function DisciplineListPage() {
  const navigate = useNavigate();
  const list = useListQuery({
    filterKeys: ['status', 'severity', 'classId'],
    defaultSortBy: 'occurredAt',
    defaultSortDir: 'desc',
  });
  const incidents = useIncidents(list.query);
  const classes = useClasses();

  const columns = useMemo<Column<DisciplineIncident>[]>(
    () => [
      {
        id: 'incident',
        header: 'Incident',
        cell: (incident) => (
          <div className="min-w-0">
            <Link
              to={`/discipline/${incident.id}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {incident.category}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {incident.referenceNo} · {formatDateTime(incident.occurredAt)}
            </p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        cell: (incident) => (
          <div className="min-w-0">
            <p className="truncate">{incident.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {incident.admissionNo}
              {incident.className ? ` · ${incident.className}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'severity',
        header: 'Severity',
        cell: (incident) => <StatusBadge status={incident.severity} />,
      },
      {
        id: 'reporter',
        header: 'Reported by',
        hideOnMobile: true,
        cell: (incident) => incident.reportedByName,
      },
      {
        id: 'guardian',
        header: 'Guardian told',
        align: 'center',
        hideOnMobile: true,
        cell: (incident) =>
          incident.guardianNotified ? (
            <Badge tone="success">Yes</Badge>
          ) : (
            <Badge tone="neutral">Not yet</Badge>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (incident) => <StatusBadge status={incident.status} />,
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Discipline"
        description="Incidents from report through review to resolution, with an audit trail at every step."
        breadcrumbs={[{ label: 'Behaviour & safety' }, { label: 'Discipline' }]}
        actions={
          <PermissionGate require="discipline.manage">
            <Button asChild>
              <Link to="/discipline/new">
                <Plus />
                Report an incident
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by student, reference or category…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS, allLabel: 'All statuses' },
          {
            key: 'severity',
            label: 'Severity',
            options: SEVERITY_OPTIONS,
            allLabel: 'All severities',
          },
          {
            key: 'classId',
            label: 'Class',
            options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })),
          },
        ]}
      />

      <DataTable
        caption="Discipline incidents with student, severity, reporter and current status"
        data={incidents.data?.items}
        meta={incidents.data?.meta}
        columns={columns}
        rowKey={(incident) => incident.id}
        isLoading={incidents.isPending}
        isFetching={incidents.isFetching}
        error={incidents.error}
        onRetry={() => void incidents.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSortChange={list.setSort}
        onRowClick={(incident) => navigate(`/discipline/${incident.id}`)}
        emptyIcon={<Gavel />}
        emptyTitle={list.isFiltered ? 'No incidents match those filters' : 'No incidents recorded'}
        emptyDescription={
          list.isFiltered
            ? 'Try clearing the filters.'
            : 'A formal record protects the child and the school alike.'
        }
      />
    </PageContainer>
  );
}

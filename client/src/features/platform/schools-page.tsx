import { useMemo, useState } from 'react';
import { Building2, CalendarPlus, MessageSquare, MessageSquarePlus, Search } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import type { PlatformSchool, PlatformSmsStatus } from '@/types/platform';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/data/data-table';
import { WARN_WITHIN_DAYS } from '@/features/subscription/school-access';
import { ActivateSchoolDialog } from './activate-school-dialog';
import { SmsCreditsDialog } from './sms-credits-dialog';
import {
  useActivateSchool,
  usePlatformSchools,
  usePlatformSmsStatus,
  useTopUpSmsCredits,
} from './use-platform-schools';

const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * The platform's own SMS position: what the KudiSMS account holds against what
 * has been promised to schools. When the second exceeds the first, the next
 * top-up of the gateway is overdue — messages will start failing at the
 * gateway with "insufficient credit" while schools still show a balance.
 */
function SmsGatewayStrip({
  status,
  loading,
}: {
  status: PlatformSmsStatus | undefined;
  loading: boolean;
}) {
  if (loading || !status) return null;

  const short =
    status.gatewayBalance !== null && status.gatewayBalance < status.promisedCredits;

  return (
    <div
      data-cy="platform-sms-gateway"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 text-sm ${
        short ? 'border-danger/30 bg-danger-subtle' : 'border-border bg-card'
      }`}
    >
      <span className="flex items-center gap-2 font-medium">
        <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
        SMS gateway
      </span>
      {!status.configured ? (
        <span className="text-muted-foreground">
          Not configured — set {status.missing.join(' and ')} in the API's .env and restart it.
        </span>
      ) : (
        <>
          <span>
            <span className="text-muted-foreground">{status.provider} balance: </span>
            <span className={`font-semibold tabular-nums ${short ? 'text-danger' : ''}`}>
              {status.gatewayBalance === null ? 'unavailable' : formatNumber(status.gatewayBalance)}
            </span>
            {status.gatewayError && (
              <span className="text-xs text-muted-foreground"> ({status.gatewayError})</span>
            )}
          </span>
          <span>
            <span className="text-muted-foreground">Promised to schools: </span>
            <span className="font-semibold tabular-nums">{formatNumber(status.promisedCredits)}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Sending as {status.senderId} · schools pay {formatCurrency(status.unitPriceNgn, 'NGN', { showDecimals: false })}/SMS
          </span>
          {short && (
            <span className="text-xs font-medium text-danger">
              Gateway holds less than schools have been given — top up KudiSMS.
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** What the school's row says about where it stands, in the order an administrator scans for it. */
function statusOf(school: PlatformSchool): { label: string; tone: 'danger' | 'warning' | 'info' | 'success' } {
  if (school.expired) return { label: 'Locked', tone: 'danger' };
  if (school.daysLeft <= WARN_WITHIN_DAYS) return { label: 'Ending soon', tone: 'warning' };
  return school.plan === 'TRIAL' ? { label: 'Free trial', tone: 'info' } : { label: 'Active', tone: 'success' };
}

function sinceOrUntil(school: PlatformSchool): string {
  if (!school.expired) return `${plural(school.daysLeft)} left`;
  const days = Math.max(1, Math.floor((Date.now() - new Date(school.endsAt).getTime()) / 86_400_000));
  return `ended ${plural(days)} ago`;
}

/**
 * Every school on the platform, and the one action that matters here: giving a
 * school more months of access.
 *
 * Only the people named in the server's `SUBSCRIPTION_ADMIN_EMAILS` reach this —
 * the route is guarded here and the API refuses anyone else regardless.
 */
export function PlatformSchoolsPage() {
  const schools = usePlatformSchools();
  const activate = useActivateSchool();
  const topUp = useTopUpSmsCredits();
  const smsStatus = usePlatformSmsStatus();
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<PlatformSchool | null>(null);
  const [creditTarget, setCreditTarget] = useState<PlatformSchool | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = schools.data ?? [];
    if (!needle) return all;
    return all.filter((school) =>
      [school.name, school.code, school.slug, school.email].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [schools.data, search]);

  const counts = useMemo(() => {
    const all = schools.data ?? [];
    return {
      total: all.length,
      locked: all.filter((school) => school.expired).length,
      trial: all.filter((school) => !school.expired && school.plan === 'TRIAL').length,
    };
  }, [schools.data]);

  const columns: Column<PlatformSchool>[] = [
    {
      id: 'school',
      header: 'School',
      cell: (school) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{school.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {school.code} · {school.slug}
          </p>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      hideOnMobile: true,
      cell: (school) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{school.email}</p>
          {school.phone && <p className="truncate text-xs text-muted-foreground">{school.phone}</p>}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (school) => {
        const status = statusOf(school);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      id: 'access',
      header: 'Access until',
      cell: (school) => (
        <div>
          <p className="text-sm">{formatDate(school.endsAt)}</p>
          <p className={`text-xs ${school.expired ? 'text-danger' : 'text-muted-foreground'}`}>
            {sinceOrUntil(school)}
          </p>
        </div>
      ),
    },
    {
      id: 'activated',
      header: 'Last activated',
      hideOnMobile: true,
      cell: (school) =>
        school.lastActivatedAt ? (
          <div className="min-w-0 text-sm">
            <p>{formatDate(school.lastActivatedAt)}</p>
            <p className="truncate text-xs text-muted-foreground">{school.lastActivatedBy}</p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Never</span>
        ),
    },
    {
      id: 'sms',
      header: 'SMS credit',
      align: 'right',
      cell: (school) => (
        <div className="text-right">
          <p className={`text-sm tabular-nums ${school.smsCredits === 0 ? 'text-danger' : ''}`}>
            {formatNumber(school.smsCredits)} SMS
          </p>
          {smsStatus.data && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatCurrency(school.smsCredits * smsStatus.data.unitPriceNgn, 'NGN', { showDecimals: false })}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (school) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            data-cy="platform-sms-credits"
            onClick={() => setCreditTarget(school)}
            title="Add SMS credit"
          >
            <MessageSquarePlus aria-hidden="true" />
            Top up
          </Button>
          <Button
            size="sm"
            variant={school.expired ? 'primary' : 'outline'}
            data-cy="platform-activate"
            onClick={() => setTarget(school)}
          >
            <CalendarPlus aria-hidden="true" />
            Activate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Schools"
        description="Every school on the platform. A school locks when its 14-day trial or its paid month ends; activating one gives it as many months as you choose. SMS credit is prepaid per school and topped up here once it has been paid for."
        breadcrumbs={[{ label: 'Platform' }, { label: 'Schools' }]}
        meta={
          schools.data ? (
            <>
              <Badge tone="neutral">{counts.total} schools</Badge>
              {counts.locked > 0 && <Badge tone="danger">{counts.locked} locked</Badge>}
              {counts.trial > 0 && <Badge tone="info">{counts.trial} on trial</Badge>}
              {smsStatus.data && (
                <Badge tone="primary" title="Unused SMS credit across every school, and what it was sold for">
                  {formatNumber(smsStatus.data.promisedCredits)} SMS out ·{' '}
                  {formatCurrency(smsStatus.data.promisedCredits * smsStatus.data.unitPriceNgn, 'NGN', { showDecimals: false })}
                </Badge>
              )}
            </>
          ) : undefined
        }
      />

      <SmsGatewayStrip status={smsStatus.data} loading={smsStatus.isPending} />

      <DataTable
        data-cy="platform-schools"
        caption="Schools on the platform"
        data={rows}
        columns={columns}
        rowKey={(school) => school.id}
        isLoading={schools.isPending}
        isFetching={schools.isFetching}
        error={schools.error}
        onRetry={() => void schools.refetch()}
        emptyIcon={<Building2 />}
        emptyTitle={search ? 'No school matches that search' : 'No schools yet'}
        emptyDescription={
          search ? 'Try part of its name, code or email address.' : 'Schools appear here once they register.'
        }
        toolbar={
          <Input
            data-cy="platform-schools-search"
            aria-label="Search schools"
            placeholder="Search by name, code or email…"
            leadingIcon={<Search className="size-4" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-sm"
          />
        }
      />

      <ActivateSchoolDialog
        school={target}
        loading={activate.isPending}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onConfirm={async (months) => {
          if (!target) return;
          await activate.mutateAsync({ schoolId: target.id, months });
          setTarget(null);
        }}
      />

      <SmsCreditsDialog
        school={creditTarget}
        loading={topUp.isPending}
        onOpenChange={(open) => {
          if (!open) setCreditTarget(null);
        }}
        onConfirm={async (amountNgn, note) => {
          if (!creditTarget) return;
          await topUp.mutateAsync({ schoolId: creditTarget.id, amountNgn, note: note || undefined });
          setCreditTarget(null);
        }}
      />
    </PageContainer>
  );
}

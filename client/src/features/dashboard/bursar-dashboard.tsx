import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, CreditCard, Landmark, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency, formatDateTime, formatPercent } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useBursarDashboard } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

export function BursarDashboard() {
  const dashboard = useBursarDashboard();
  const data = dashboard.data;
  const currency = data?.currency ?? 'NGN';

  const header = (
    <PageHeader
      title="Finance"
      description="What has been billed, what has come in, and what still has to be chased."
      actions={
        <>
          <Button data-cy="bursar-dashboard-new-invoice" variant="outline" asChild>
            <Link to="/finance/invoices/new">
              <Receipt />
              New invoice
            </Link>
          </Button>
          <Button data-cy="bursar-dashboard-record-payment" asChild>
            <Link to="/finance/payments/new">
              <CreditCard />
              Record payment
            </Link>
          </Button>
        </>
      }
    />
  );

  if (dashboard.isError) {
    return (
      <PageContainer>
        {header}
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header}

      {dashboard.isPending ? (
        <LoadingState label="Loading the ledger…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Billed this term"
              value={formatCurrency(data?.billed ?? 0, currency)}
              icon={<Landmark />}
              to="/finance/invoices"
            />
            <StatCard
              label="Collected"
              value={formatCurrency(data?.collected ?? 0, currency)}
              hint={`${formatPercent(data?.collectionRate ?? 0)} collection rate`}
              icon={<TrendingUp />}
              tone="success"
              to="/finance/payments"
            />
            <StatCard
              label="Outstanding"
              value={formatCurrency(data?.outstanding ?? 0, currency)}
              icon={<Wallet />}
              tone={(data?.outstanding ?? 0) > 0 ? 'warning' : 'neutral'}
              to="/finance/debtors"
            />
            <StatCard
              label="Unreconciled"
              value={data?.unreconciled.count ?? 0}
              hint={formatCurrency(data?.unreconciled.amount ?? 0, currency)}
              icon={<AlertCircle />}
              tone={(data?.unreconciled.count ?? 0) > 0 ? 'danger' : 'success'}
              to="/finance/payments?reconciled=false"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Billed against collected</CardTitle>
                <CardDescription>
                  The gap between the two bars is the money still owed for that period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(data?.collectionTrend.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<TrendingUp />} title="No billing history yet" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data?.collectionTrend}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                        <XAxis dataKey="label" {...chartTheme.axis} />
                        <YAxis
                          tickFormatter={(value: number) =>
                            formatCurrency(value, currency, { compact: true })
                          }
                          {...chartTheme.axis}
                        />
                        <ChartTooltip
                          {...chartTheme.tooltip}
                          formatter={(value: number) => formatCurrency(value, currency)}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="billed"
                          name="Billed"
                          fill={chartTheme.colors[1]}
                          fillOpacity={0.4}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey="collected"
                          name="Collected"
                          fill={chartTheme.colors[2]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent payments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.recentPayments.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<Receipt />} title="No payments yet today" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.recentPayments.slice(0, 7).map((payment) => (
                      <li key={payment.id} className="px-5 py-2.5 text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{payment.studentName}</span>
                          <span className="shrink-0 tabular-nums">
                            {formatCurrency(payment.amount, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-muted-foreground">
                            {humanizeEnum(payment.method)} · {formatDateTime(payment.paidAt)}
                          </p>
                          {!payment.isReconciled && (
                            <Badge tone="warning" className="shrink-0">
                              Unreconciled
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Largest outstanding balances</CardTitle>
              <CardDescription>
                Start here when chasing fees — these families owe the most, for the longest.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(data?.topDebtors.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={<Wallet />}
                  title="Every account is settled"
                  description="No family currently has an outstanding balance."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data?.topDebtors.map((debtor) => (
                    <li
                      key={debtor.studentId}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/students/${debtor.studentId}`}
                          className="truncate font-medium hover:text-primary hover:underline"
                        >
                          {debtor.studentName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {debtor.className ?? 'No class'} · {debtor.daysOverdue} days overdue
                        </p>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums text-danger">
                        {formatCurrency(debtor.balance, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}

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
import { formatCurrency, formatPercent } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useFinanceOverview } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import { chartTheme } from '@/components/charts/chart-theme';

export function FinanceOverviewPage() {
  const overview = useFinanceOverview();
  const data = overview.data;
  const currency = data?.currency ?? 'NGN';

  return (
    <PageContainer>
      <PageHeader
        title="Finance"
        description="Billing, collection and what is still outstanding across the school."
        breadcrumbs={[{ label: 'Finance' }]}
        actions={
          <>
            <PermissionGate require="invoice.manage">
              <Button variant="outline" asChild>
                <Link to="/finance/invoices/new">
                  <Receipt />
                  New invoice
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate require="payment.manage">
              <Button asChild>
                <Link to="/finance/payments/new">
                  <CreditCard />
                  Record payment
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.isPending ? (
        <LoadingState label="Loading finance overview…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total billed"
              value={formatCurrency(data?.totalBilled ?? 0, currency)}
              icon={<Landmark />}
              to="/finance/invoices"
            />
            <StatCard
              label="Collected"
              value={formatCurrency(data?.totalCollected ?? 0, currency)}
              hint={`${formatPercent(data?.collectionRate ?? 0)} of what was billed`}
              icon={<TrendingUp />}
              tone="success"
              to="/finance/payments"
            />
            <StatCard
              label="Outstanding"
              value={formatCurrency(data?.totalOutstanding ?? 0, currency)}
              hint={`${data?.debtorCount ?? 0} families`}
              icon={<Wallet />}
              tone={(data?.totalOutstanding ?? 0) > 0 ? 'warning' : 'neutral'}
              to="/finance/debtors"
            />
            <StatCard
              label="Unreconciled"
              value={data?.unreconciledCount ?? 0}
              hint={formatCurrency(data?.unreconciledAmount ?? 0, currency)}
              icon={<AlertCircle />}
              tone={(data?.unreconciledCount ?? 0) > 0 ? 'danger' : 'success'}
              to="/finance/payments?reconciled=false"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Collection over time</CardTitle>
                <CardDescription>
                  Billed against collected, term by term. A widening gap is the signal to start
                  chasing before the next set of invoices goes out.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(data?.collectionTrend.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<TrendingUp />} title="No billing history yet" />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data?.collectionTrend}
                        margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
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
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="collected"
                          name="Collected"
                          fill={chartTheme.colors[2]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By fee category</CardTitle>
                <CardDescription>Where collection is strongest and weakest.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.byCategory.length ?? 0) === 0 ? (
                  <EmptyState compact title="Nothing billed yet" />
                ) : (
                  data?.byCategory.map((row) => {
                    const rate = row.billed === 0 ? 0 : (row.collected / row.billed) * 100;
                    return (
                      <div key={row.category}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate">{humanizeEnum(row.category)}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatCurrency(row.collected, currency, { compact: true })} /{' '}
                            {formatCurrency(row.billed, currency, { compact: true })}
                          </span>
                        </div>
                        <Progress
                          className="mt-1"
                          value={rate}
                          tone={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}
                        />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-wrap gap-3 pt-5">
              <Button variant="outline" asChild>
                <Link to="/finance/fees">Fee items and structures</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/finance/invoices">All invoices</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/finance/payments">All payments</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/finance/debtors">Debtors</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}

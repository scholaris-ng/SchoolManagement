import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { useFinanceOverview } from '@/features/finance/api';
import { StatCard } from '@/components/data/stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

export function FinancePanel({ termId }: { termId: string }) {
  const overview = useFinanceOverview({ termId: termId || undefined });
  const data = overview.data;
  const currency = data?.currency ?? 'NGN';

  if (overview.isError) {
    return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Billed"
          value={formatCurrency(data?.totalBilled ?? 0, currency, { showDecimals: false })}
          icon={<Wallet />}
          loading={overview.isPending}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(data?.totalCollected ?? 0, currency, { showDecimals: false })}
          tone="success"
          icon={<Wallet />}
          loading={overview.isPending}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data?.totalOutstanding ?? 0, currency, { showDecimals: false })}
          tone="danger"
          to="/finance/debtors"
          icon={<Activity />}
          loading={overview.isPending}
        />
        <StatCard
          label="Collection rate"
          value={formatPercent(data?.collectionRate ?? 0)}
          hint={`${formatNumber(data?.debtorCount ?? 0)} families owing`}
          icon={<Wallet />}
          loading={overview.isPending}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Billed against collected</CardTitle>
            <CardDescription>The gap is the cash still to be recovered.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.isPending ? (
              <LoadingState label="Loading finance…" />
            ) : (data?.collectionTrend.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Wallet />} title="Nothing invoiced yet" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data?.collectionTrend}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="label" {...chartTheme.axis} />
                    <YAxis
                      {...chartTheme.axis}
                      tickFormatter={(value: number) => `${formatNumber(value / 1000)}k`}
                    />
                    <ChartTooltip
                      {...chartTheme.tooltip}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="billed"
                      name="Billed"
                      stroke={chartTheme.colors[1]}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="collected"
                      name="Collected"
                      stroke={chartTheme.colors[2]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By fee category</CardTitle>
            <CardDescription>Where the money is billed, and where it arrives.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {overview.isPending ? (
              <LoadingState label="Loading categories…" />
            ) : (data?.byCategory.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Wallet />} title="No fee categories billed yet" />
            ) : (
              <ul className="divide-y divide-border">
                {data?.byCategory.map((category) => (
                  <li key={category.category} className="space-y-1.5 px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{category.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(category.collected, currency, { showDecimals: false })} of{' '}
                        {formatCurrency(category.billed, currency, { showDecimals: false })}
                      </span>
                    </div>
                    <Progress
                      value={category.billed ? (category.collected / category.billed) * 100 : 0}
                      tone="success"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Admissions                                                                  */
/* -------------------------------------------------------------------------- */

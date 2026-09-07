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
import type { SubjectResultLine } from '@/types/results';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { chartTheme } from '@/components/charts/chart-theme';

/**
 * A parent reading a page of numbers learns much less than one who can see, at
 * a glance, where their child sits against the class (research feature 18).
 */
export function SubjectPerformanceChart({ subjects }: { subjects: SubjectResultLine[] }) {
  const data = subjects
    .filter((subject) => subject.total !== null)
    .map((subject) => ({
      subject: subject.subjectName.length > 14
        ? `${subject.subjectName.slice(0, 13)}…`
        : subject.subjectName,
      fullName: subject.subjectName,
      score: subject.total ?? 0,
      classAverage: subject.classAverage ?? 0,
    }));

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance against the class</CardTitle>
        <CardDescription>
          Each subject score next to the average for the whole class.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={chartTheme.grid} />
              <XAxis
                dataKey="subject"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
                {...chartTheme.axis}
              />
              <YAxis domain={[0, 100]} {...chartTheme.axis} />
              <ChartTooltip
                {...chartTheme.tooltip}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="score"
                name="This student"
                fill={chartTheme.colors[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="classAverage"
                name="Class average"
                fill={chartTheme.colors[1]}
                fillOpacity={0.45}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

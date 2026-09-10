import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  UserCog,
} from 'lucide-react';
import { exportRowsToXlsx } from '@/lib/xlsx';
import { useStaffPerformance } from '@/features/staff/api';
import { ComplianceCell } from './analytics-page-parts';
import type { StaffPerformanceRow } from '@/types/analytics';
import { DataTable, type Column } from '@/components/data/data-table';
import { Button } from '@/components/ui/button';

export function StaffPanel({ termId }: { termId: string }) {
  const performance = useStaffPerformance(termId || undefined);

  const columns = useMemo<Column<StaffPerformanceRow>[]>(
    () => [
      {
        id: 'staff',
        header: 'Teacher',
        cell: (row) => (
          <div className="min-w-0">
            <Link
              to={`/staff/${row.staffId}`}
              className="block truncate font-medium hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.staffName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{row.designation}</p>
          </div>
        ),
      },
      {
        id: 'classes',
        header: 'Classes',
        align: 'right',
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{row.classCount}</span>,
      },
      {
        id: 'attendance',
        header: 'Registers',
        cell: (row) => <ComplianceCell value={row.attendanceCompliance} />,
      },
      {
        id: 'notes',
        header: 'Lesson notes',
        cell: (row) => <ComplianceCell value={row.lessonNoteCompliance} />,
      },
      {
        id: 'scores',
        header: 'Score entry',
        hideOnMobile: true,
        cell: (row) => <ComplianceCell value={row.scoreEntryTimeliness} />,
      },
      {
        id: 'coverage',
        header: 'Curriculum',
        hideOnMobile: true,
        cell: (row) => <ComplianceCell value={row.curriculumCoverage} />,
      },
      {
        id: 'composite',
        header: 'Overall',
        align: 'right',
        cell: (row) => <span className="font-medium tabular-nums">{row.compositeScore}%</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 pt-6">
      <DataTable
        data-cy="analytics-table-3"
        caption="Compliance and curriculum coverage for each member of teaching staff"
        data={performance.data}
        columns={columns}
        rowKey={(row) => row.staffId}
        isLoading={performance.isPending}
        error={performance.error}
        onRetry={() => void performance.refetch()}
        emptyIcon={<UserCog />}
        emptyTitle="No teaching activity recorded yet"
        emptyDescription="Figures appear once staff start taking registers and submitting notes."
        toolbar={
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Teaching compliance</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Whether the routines that keep records honest are happening — registers taken, notes
                submitted, scores entered on time, syllabus covered. A prompt for support, not a
                league table to publish.
              </p>
            </div>
            <Button
              data-cy="analytics-export-2"
              variant="outline"
              size="sm"
              disabled={(performance.data?.length ?? 0) === 0}
              onClick={() =>
                void exportRowsToXlsx(
                  `staff-performance-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  (performance.data ?? []).map((row) => ({
                    Teacher: row.staffName,
                    Designation: row.designation,
                    Classes: row.classCount,
                    'Register compliance': row.attendanceCompliance,
                    'Lesson note compliance': row.lessonNoteCompliance,
                    'Score entry timeliness': row.scoreEntryTimeliness,
                    'Curriculum coverage': row.curriculumCoverage,
                    Overall: row.compositeScore,
                  })),
                  { sheetName: 'Staff performance' },
                )
              }
            >
              <Download />
              Export
            </Button>
          </div>
        }
      />
    </div>
  );
}

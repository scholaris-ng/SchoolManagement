/**
 * Pieces used by `analytics-page`, split one per component so none outgrows
 * the limit in section 17 of the frontend guide.
 */
export { AcademicPanel } from './academic-panel';
export { AttendancePanel } from './attendance-panel';
export { FinancePanel } from './finance-panel';
export { AdmissionsPanel } from './admissions-panel';
export { StaffPanel } from './staff-panel';

import { useSearchParams } from 'react-router-dom';
import {
  Progress,
} from '@/components/ui/primitives';

/**
 * Pieces used by `analytics-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function useTermSelection(currentTermId: string | undefined): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') ?? currentTermId ?? '';

  const setTermId = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === currentTermId) next.delete('termId');
        else next.set('termId', value);
        return next;
      },
      { replace: true },
    );

  return [termId, setTermId];
}

/* -------------------------------------------------------------------------- */
/* Academic                                                                    */
/* -------------------------------------------------------------------------- */

export function ComplianceCell({ value }: { value: number }) {
  return (
    <Progress
      value={value}
      showLabel
      tone={value >= 85 ? 'success' : value >= 65 ? 'warning' : 'danger'}
      className="min-w-[7rem]"
    />
  );
}

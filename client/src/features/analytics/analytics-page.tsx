import { useMemo } from 'react';
import {
  BadgeCheck,
  ClipboardCheck,
  ScrollText,
  UserCog,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { useCurrentTerm, useTermOptions } from '@/features/academics/api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { TabPanel, TabStrip, useTabState, type TabDefinition } from '@/components/layout/tab-strip';
import { NativeSelect } from '@/components/ui/input';
import { useTermSelection, AcademicPanel, AttendancePanel, FinancePanel, AdmissionsPanel, StaffPanel } from './analytics-page-parts';

/**
 * Management analytics.
 *
 * Every figure here is aggregated by the API — the browser asks one question
 * per panel and never pages through thousands of rows to add them up (spec
 * sections 32 and 43). Each tab is a separate query, so opening the page on a
 * phone fetches the academic summary and nothing else.
 */
export function AnalyticsPage() {
  const { can } = useAuth();
  const currentTerm = useCurrentTerm();
  const termOptions = useTermOptions();
  const [termId, setTermId] = useTermSelection(currentTerm.data?.id);

  const tabs = useMemo<TabDefinition[]>(() => {
    const all: (TabDefinition | null)[] = [
      { id: 'academic', label: 'Academic', icon: ScrollText },
      { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
      { id: 'finance', label: 'Finance', icon: Wallet },
      { id: 'admissions', label: 'Admissions', icon: BadgeCheck },
      can('analytics.staff') ? { id: 'staff', label: 'Staff', icon: UserCog } : null,
    ];
    return all.filter((tab): tab is TabDefinition => tab !== null);
  }, [can]);

  const { activeId, setActive } = useTabState(tabs);

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="How the school is performing this term, across teaching, attendance, money and admissions."
        breadcrumbs={[{ label: 'Overview' }, { label: 'Analytics' }]}
        actions={
          <NativeSelect
            data-cy="analytics-term-id"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
            aria-label="Term"
            className="h-9 w-auto min-w-[12rem]"
          >
            {termOptions.length === 0 && <option value="">Current term</option>}
            {termOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        }
      />

      <TabStrip tabs={tabs} activeId={activeId} onChange={setActive} label="Analytics sections" />

      <TabPanel tabId={activeId}>
        {activeId === 'academic' && <AcademicPanel termId={termId} />}
        {activeId === 'attendance' && <AttendancePanel />}
        {activeId === 'finance' && <FinancePanel termId={termId} />}
        {activeId === 'admissions' && <AdmissionsPanel />}
        {activeId === 'staff' && <StaffPanel termId={termId} />}
      </TabPanel>
    </PageContainer>
  );
}

/**
 * The chosen term lives in the URL alongside the tab, so "the finance view for
 * last term" is a link somebody can send to the principal.
 */

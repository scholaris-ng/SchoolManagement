import { useState } from 'react';
import {
  CalendarRange,
  Clock,
  GraduationCap,
  Layers,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAcademicSessions,
  useClasses,
  useDeletePeriod,
  useDeleteSession,
  useHouses,
  useLevels,
  usePeriods,
  useSetCurrentTerm,
  useSubjects,
  useTerms,
} from '@/features/academics/api';
import type { AcademicSession, House, SchoolClass, SchoolLevel, Subject, Term } from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SettingsTabs } from './settings-tabs';
import { AcademicsDialogs } from './academics/academics-dialogs';
import { SessionsPanel } from './academics/sessions-panel';
import { PeriodsPanel } from './academics/periods-panel';
import { LevelsPanel } from './academics/levels-panel';
import { ClassesPanel } from './academics/classes-panel';
import { SubjectsPanel } from './academics/subjects-panel';
import { HousesPanel } from './academics/houses-panel';

type Tab = 'sessions' | 'periods' | 'levels' | 'classes' | 'subjects' | 'houses';

/**
 * The academic structure, defined by the school rather than the software.
 *
 * Nothing here assumes Nursery/Primary/JSS/SSS. A school entering Reception
 * through Year 11, or Creche through SS3, gets the same screens and the same
 * behaviour everywhere else in the product (spec section 6).
 */
export function AcademicsSettingsPage() {
  const [tab, setTab] = useState<Tab>('sessions');

  const sessions = useAcademicSessions();
  const terms = useTerms();
  const periods = usePeriods();
  const levels = useLevels();
  const classes = useClasses({ includeInactive: true });
  const subjects = useSubjects();
  const houses = useHouses();

  const setCurrentTerm = useSetCurrentTerm();
  const deleteSession = useDeleteSession();
  const deletePeriod = useDeletePeriod();

  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; session?: AcademicSession }>({
    open: false,
  });
  const [termDialog, setTermDialog] = useState<{
    open: boolean;
    term?: Term;
    sessionId?: string;
    sessionName?: string;
  }>({ open: false });
  const [periodDialog, setPeriodDialog] = useState<{ open: boolean; period?: TimetablePeriod }>({
    open: false,
  });
  const [pendingDeleteSession, setPendingDeleteSession] = useState<AcademicSession | null>(null);
  const [pendingDeletePeriod, setPendingDeletePeriod] = useState<TimetablePeriod | null>(null);
  const [levelDialog, setLevelDialog] = useState<{ open: boolean; level?: SchoolLevel }>({
    open: false,
  });
  const [classDialog, setClassDialog] = useState<{ open: boolean; schoolClass?: SchoolClass }>({
    open: false,
  });
  const [subjectDialog, setSubjectDialog] = useState<{ open: boolean; subject?: Subject }>({
    open: false,
  });
  const [houseDialog, setHouseDialog] = useState<{ open: boolean; house?: House }>({ open: false });

  const tabs: { id: Tab; label: string; icon: typeof Layers }[] = [
    { id: 'sessions', label: 'Sessions & terms', icon: CalendarRange },
    { id: 'periods', label: 'Periods', icon: Clock },
    { id: 'levels', label: 'Levels', icon: Layers },
    { id: 'classes', label: 'Classes', icon: Users },
    { id: 'subjects', label: 'Subjects', icon: GraduationCap },
    { id: 'houses', label: 'Houses', icon: Trophy },
  ];

  const newAction = {
    sessions: () => setSessionDialog({ open: true }),
    periods: () => setPeriodDialog({ open: true }),
    levels: () => setLevelDialog({ open: true }),
    classes: () => setClassDialog({ open: true }),
    subjects: () => setSubjectDialog({ open: true }),
    houses: () => setHouseDialog({ open: true }),
  }[tab];

  return (
    <PageContainer>
      <PageHeader
        title="Academic setup"
        description="Sessions, terms, levels, classes, subjects and houses — all defined by your school."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Academic setup' }]}
        actions={
          newAction && (
            <Button data-cy="settings-academics-settings-new" onClick={newAction}>
              <Plus />
              New {tab.slice(0, -1)}
            </Button>
          )
        }
      />

      <SettingsTabs />

      <div role="tablist" aria-label="Academic structure" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            data-cy={`academics-settings-tab-${option.id}`}
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
              tab === option.id
                ? // White in dark mode, matching the sidebar's active item —
                  // see the identical note in `tab-strip.tsx`.
                  'text-primary after:bg-primary dark:text-white'
                : 'text-muted-foreground after:bg-transparent hover:text-foreground',
            )}
          >
            <option.icon className="size-4" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'sessions' && (
        <SessionsPanel
          sessions={sessions}
          termsBySession={(sessionId) => (terms.data ?? []).filter((t) => t.sessionId === sessionId)}
          onEditSession={(session) => setSessionDialog({ open: true, session })}
          onDeleteSession={setPendingDeleteSession}
          onAddTerm={(session) =>
            setTermDialog({ open: true, sessionId: session.id, sessionName: session.name })
          }
          onEditTerm={(term, session) =>
            setTermDialog({ open: true, term, sessionId: session.id, sessionName: session.name })
          }
          onSetCurrentTerm={(termId) => setCurrentTerm.mutate(termId)}
          isSettingCurrentTerm={setCurrentTerm.isPending}
        />
      )}

      {tab === 'periods' && (
        <PeriodsPanel
          periods={periods}
          onEdit={(period) => setPeriodDialog({ open: true, period })}
          onDelete={setPendingDeletePeriod}
        />
      )}

      {tab === 'levels' && (
        <LevelsPanel levels={levels} onEdit={(level) => setLevelDialog({ open: true, level })} />
      )}

      {tab === 'classes' && (
        <ClassesPanel
          classes={classes}
          onEdit={(schoolClass) => setClassDialog({ open: true, schoolClass })}
        />
      )}

      {tab === 'subjects' && (
        <SubjectsPanel
          subjects={subjects}
          onEdit={(subject) => setSubjectDialog({ open: true, subject })}
        />
      )}

      {tab === 'houses' && (
        <HousesPanel houses={houses} onEdit={(house) => setHouseDialog({ open: true, house })} />
      )}
      <AcademicsDialogs
        state={{
          sessionDialog,
          termDialog,
          periodDialog,
          levelDialog,
          classDialog,
          subjectDialog,
          houseDialog,
          pendingDeleteSession,
          pendingDeletePeriod,
        }}
        close={(key) => {
          if (key === 'sessionDialog') setSessionDialog({ open: false });
          if (key === 'termDialog') setTermDialog({ open: false });
          if (key === 'periodDialog') setPeriodDialog({ open: false });
          if (key === 'levelDialog') setLevelDialog({ open: false });
          if (key === 'classDialog') setClassDialog({ open: false });
          if (key === 'subjectDialog') setSubjectDialog({ open: false });
          if (key === 'houseDialog') setHouseDialog({ open: false });
          if (key === 'pendingDeleteSession') setPendingDeleteSession(null);
          if (key === 'pendingDeletePeriod') setPendingDeletePeriod(null);
        }}
        levels={levels.data ?? []}
        periods={periods.data ?? []}
        sessionCount={sessions.data?.length ?? 0}
        levelCount={levels.data?.length ?? 0}
        periodCount={periods.data?.length ?? 0}
        onDeleteSession={async (session) => {
          await deleteSession.mutateAsync(session.id);
          setPendingDeleteSession(null);
        }}
        onDeletePeriod={async (period) => {
          await deletePeriod.mutateAsync(period.id);
          setPendingDeletePeriod(null);
        }}
        isDeletingSession={deleteSession.isPending}
        isDeletingPeriod={deletePeriod.isPending}
      />
    </PageContainer>
  );
}

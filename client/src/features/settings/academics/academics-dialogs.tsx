import { ConfirmDialog } from '@/components/ui/dialog';
import type { AcademicSession, House, SchoolClass, SchoolLevel, Subject, Term } from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';
import { SessionDialog } from './session-dialog';
import { TermDialog } from './term-dialog';
import { PeriodDialog } from './period-dialog';
import { LevelDialog } from './level-dialog';
import { ClassDialog } from './class-dialog';
import { SubjectDialog } from './subject-dialog';
import { HouseDialog } from './house-dialog';

export interface AcademicsDialogState {
  sessionDialog: { open: boolean; session?: AcademicSession };
  termDialog: { open: boolean; term?: Term; sessionId?: string; sessionName?: string };
  periodDialog: { open: boolean; period?: TimetablePeriod };
  levelDialog: { open: boolean; level?: SchoolLevel };
  classDialog: { open: boolean; schoolClass?: SchoolClass };
  subjectDialog: { open: boolean; subject?: Subject };
  houseDialog: { open: boolean; house?: House };
  pendingDeleteSession: AcademicSession | null;
  pendingDeletePeriod: TimetablePeriod | null;
}

/**
 * Every dialog the academic-setup screen can open.
 *
 * They live together because their state is owned by the page — the "New …"
 * action in the page header has to reach whichever one matches the open tab.
 */
export function AcademicsDialogs({
  state,
  close,
  levels,
  periods,
  levelCount,
  periodCount,
  onDeleteSession,
  onDeletePeriod,
  isDeletingSession,
  isDeletingPeriod,
}: {
  state: AcademicsDialogState;
  close: (key: keyof AcademicsDialogState) => void;
  levels: SchoolLevel[];
  periods: TimetablePeriod[];
  sessionCount: number;
  levelCount: number;
  periodCount: number;
  onDeleteSession: (session: AcademicSession) => Promise<void>;
  onDeletePeriod: (period: TimetablePeriod) => Promise<void>;
  isDeletingSession: boolean;
  isDeletingPeriod: boolean;
}) {
  return (
    <>
        <SessionDialog
          key={state.sessionDialog.session?.id ?? 'new-session'}
          state={state.sessionDialog}
          onClose={() => close('sessionDialog')}
        />
        <TermDialog
          key={state.termDialog.term?.id ?? `new-term-${state.termDialog.sessionId ?? ''}`}
          state={state.termDialog}
          onClose={() => close('termDialog')}
        />
        <PeriodDialog
          key={state.periodDialog.period?.id ?? 'new-period'}
          state={state.periodDialog}
          nextSequence={periodCount + 1}
          onClose={() => close('periodDialog')}
        />
  
        <ConfirmDialog
          open={Boolean(state.pendingDeleteSession)}
          onOpenChange={(open) => !open && close('pendingDeleteSession')}
          title="Delete this academic session?"
          description={`"${state.pendingDeleteSession?.name}" and its ${state.pendingDeleteSession?.termCount ?? 0} term(s) will be permanently removed.`}
          confirmLabel="Delete"
          tone="danger"
          loading={isDeletingSession}
          onConfirm={async () => {
            if (state.pendingDeleteSession) await onDeleteSession(state.pendingDeleteSession);
          }}
        />
        <ConfirmDialog
          open={Boolean(state.pendingDeletePeriod)}
          onOpenChange={(open) => !open && close('pendingDeletePeriod')}
          title="Delete this period?"
          description={`"${state.pendingDeletePeriod?.name}" will be removed from the school day and from the timetable grid.`}
          confirmLabel="Delete"
          tone="danger"
          loading={isDeletingPeriod}
          onConfirm={async () => {
            if (state.pendingDeletePeriod) await onDeletePeriod(state.pendingDeletePeriod);
          }}
        />
  
        <LevelDialog
          key={state.levelDialog.level?.id ?? 'new-level'}
          state={state.levelDialog}
          nextSequence={levelCount + 1}
          onClose={() => close('levelDialog')}
        />
        <ClassDialog
          key={state.classDialog.schoolClass?.id ?? 'new-class'}
          state={state.classDialog}
          levels={levels.map((level) => ({ value: level.id, label: level.name }))}
          onClose={() => close('classDialog')}
        />
        <SubjectDialog
          key={state.subjectDialog.subject?.id ?? 'new-subject'}
          state={state.subjectDialog}
          levels={levels}
          periods={periods}
          onClose={() => close('subjectDialog')}
        />
        <HouseDialog
          key={state.houseDialog.house?.id ?? 'new-house'}
          state={state.houseDialog}
          onClose={() => close('houseDialog')}
        />
    </>
  );
}

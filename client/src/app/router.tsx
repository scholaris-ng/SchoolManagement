import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from './layouts/app-shell';
import { RequireAuth, RequirePermission } from '@/components/guards/permission-gate';
import type { PermissionRequirement } from '@/lib/permissions';

/**
 * The route tree.
 *
 * Every page below the shell is code-split: a parent on a phone downloads the
 * dashboard and their children's results, not the bursar's invoicing screens.
 * `AppShell` already provides the Suspense boundary these lazy chunks need.
 *
 * Route-level `RequirePermission` mirrors the sidebar's filtering so a
 * deep-linked or bookmarked URL refuses cleanly instead of rendering a page
 * whose every request then 403s. The API remains the authority (spec section 5).
 */

/* -- Public ---------------------------------------------------------------- */
const SignInPage = lazy(() =>
  import('@/features/auth/sign-in-page').then((m) => ({ default: m.SignInPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })),
);
const VerifyPage = lazy(() =>
  import('@/features/public/verify-page').then((m) => ({ default: m.VerifyPage })),
);
const SchoolWebsitePage = lazy(() =>
  import('@/features/public/school-website-page').then((m) => ({ default: m.SchoolWebsitePage })),
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/onboarding-page').then((m) => ({ default: m.OnboardingPage })),
);
const NotFoundPage = lazy(() =>
  import('@/features/errors/not-found-page').then((m) => ({ default: m.NotFoundPage })),
);

/* -- Dashboards & analytics ------------------------------------------------ */
const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/analytics-page').then((m) => ({ default: m.AnalyticsPage })),
);
const RetentionPage = lazy(() =>
  import('@/features/analytics/retention-page').then((m) => ({ default: m.RetentionPage })),
);

/* -- People ---------------------------------------------------------------- */
const StudentsListPage = lazy(() =>
  import('@/features/students/students-list-page').then((m) => ({ default: m.StudentsListPage })),
);
const StudentFormPage = lazy(() =>
  import('@/features/students/student-form-page').then((m) => ({ default: m.StudentFormPage })),
);
const StudentDetailPage = lazy(() =>
  import('@/features/students/student-detail-page').then((m) => ({ default: m.StudentDetailPage })),
);
const GuardiansListPage = lazy(() =>
  import('@/features/guardians/guardians-list-page').then((m) => ({ default: m.GuardiansListPage })),
);
const GuardianFormPage = lazy(() =>
  import('@/features/guardians/guardian-form-page').then((m) => ({ default: m.GuardianFormPage })),
);
const GuardianDetailPage = lazy(() =>
  import('@/features/guardians/guardian-detail-page').then((m) => ({
    default: m.GuardianDetailPage,
  })),
);
const StaffListPage = lazy(() =>
  import('@/features/staff/staff-list-page').then((m) => ({ default: m.StaffListPage })),
);
const StaffFormPage = lazy(() =>
  import('@/features/staff/staff-form-page').then((m) => ({ default: m.StaffFormPage })),
);
const StaffDetailPage = lazy(() =>
  import('@/features/staff/staff-detail-page').then((m) => ({ default: m.StaffDetailPage })),
);
const AdmissionsListPage = lazy(() =>
  import('@/features/admissions/admissions-list-page').then((m) => ({
    default: m.AdmissionsListPage,
  })),
);
const AdmissionFormPage = lazy(() =>
  import('@/features/admissions/admission-form-page').then((m) => ({
    default: m.AdmissionFormPage,
  })),
);
const AdmissionDetailPage = lazy(() =>
  import('@/features/admissions/admission-detail-page').then((m) => ({
    default: m.AdmissionDetailPage,
  })),
);
const ImportPage = lazy(() =>
  import('@/features/imports/import-page').then((m) => ({ default: m.ImportPage })),
);

/* -- Teaching -------------------------------------------------------------- */
const AttendancePage = lazy(() =>
  import('@/features/attendance/attendance-page').then((m) => ({ default: m.AttendancePage })),
);
const TimetablePage = lazy(() =>
  import('@/features/timetable/timetable-page').then((m) => ({ default: m.TimetablePage })),
);
const CurriculumListPage = lazy(() =>
  import('@/features/curriculum/curriculum-list-page').then((m) => ({
    default: m.CurriculumListPage,
  })),
);
const CurriculumDetailPage = lazy(() =>
  import('@/features/curriculum/curriculum-detail-page').then((m) => ({
    default: m.CurriculumDetailPage,
  })),
);
const SchemesPage = lazy(() =>
  import('@/features/curriculum/schemes-page').then((m) => ({ default: m.SchemesPage })),
);
const SchemeDetailPage = lazy(() =>
  import('@/features/curriculum/scheme-detail-page').then((m) => ({ default: m.SchemeDetailPage })),
);
const LessonNotesPage = lazy(() =>
  import('@/features/curriculum/lesson-notes-page').then((m) => ({ default: m.LessonNotesPage })),
);
const LessonNoteFormPage = lazy(() =>
  import('@/features/curriculum/lesson-note-form-page').then((m) => ({
    default: m.LessonNoteFormPage,
  })),
);
const CalendarPage = lazy(() =>
  import('@/features/calendar/calendar-page').then((m) => ({ default: m.CalendarPage })),
);

/* -- Assessment ------------------------------------------------------------ */
const ScoreEntryPage = lazy(() =>
  import('@/features/results/score-entry-page').then((m) => ({ default: m.ScoreEntryPage })),
);
const ScoreSheetPage = lazy(() =>
  import('@/features/results/score-sheet-page').then((m) => ({ default: m.ScoreSheetPage })),
);
const ResultsPage = lazy(() =>
  import('@/features/results/results-page').then((m) => ({ default: m.ResultsPage })),
);
const ReportCardsPage = lazy(() =>
  import('@/features/results/report-cards-page').then((m) => ({ default: m.ReportCardsPage })),
);
const ReportCardPage = lazy(() =>
  import('@/features/results/report-card-page').then((m) => ({ default: m.ReportCardPage })),
);
const TranscriptsPage = lazy(() =>
  import('@/features/results/transcripts-page').then((m) => ({ default: m.TranscriptsPage })),
);
const TranscriptPage = lazy(() =>
  import('@/features/results/transcript-page').then((m) => ({ default: m.TranscriptPage })),
);
const QuestionBankPage = lazy(() =>
  import('@/features/cbt/question-bank-page').then((m) => ({ default: m.QuestionBankPage })),
);
const AssessmentsPage = lazy(() =>
  import('@/features/cbt/assessments-page').then((m) => ({ default: m.AssessmentsPage })),
);
const AssessmentDetailPage = lazy(() =>
  import('@/features/cbt/assessment-detail-page').then((m) => ({
    default: m.AssessmentDetailPage,
  })),
);
const AttemptPage = lazy(() =>
  import('@/features/cbt/attempt-page').then((m) => ({ default: m.AttemptPage })),
);

/* -- Finance --------------------------------------------------------------- */
const FinanceOverviewPage = lazy(() =>
  import('@/features/finance/finance-overview-page').then((m) => ({
    default: m.FinanceOverviewPage,
  })),
);
const FeesPage = lazy(() =>
  import('@/features/finance/fees-page').then((m) => ({ default: m.FeesPage })),
);
const InvoicesPage = lazy(() =>
  import('@/features/finance/invoices-page').then((m) => ({ default: m.InvoicesPage })),
);
const InvoiceFormPage = lazy(() =>
  import('@/features/finance/invoice-form-page').then((m) => ({ default: m.InvoiceFormPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('@/features/finance/invoice-detail-page').then((m) => ({ default: m.InvoiceDetailPage })),
);
const PaymentsPage = lazy(() =>
  import('@/features/finance/payments-page').then((m) => ({ default: m.PaymentsPage })),
);
const PaymentFormPage = lazy(() =>
  import('@/features/finance/payment-form-page').then((m) => ({ default: m.PaymentFormPage })),
);
const ReceiptPage = lazy(() =>
  import('@/features/finance/receipt-page').then((m) => ({ default: m.ReceiptPage })),
);
const DebtorsPage = lazy(() =>
  import('@/features/finance/debtors-page').then((m) => ({ default: m.DebtorsPage })),
);

/* -- Behaviour & safety ---------------------------------------------------- */
const BehaviourPage = lazy(() =>
  import('@/features/behaviour/behaviour-page').then((m) => ({ default: m.BehaviourPage })),
);
const HousesPage = lazy(() =>
  import('@/features/behaviour/houses-page').then((m) => ({ default: m.HousesPage })),
);
const DisciplineListPage = lazy(() =>
  import('@/features/discipline/discipline-list-page').then((m) => ({
    default: m.DisciplineListPage,
  })),
);
const IncidentFormPage = lazy(() =>
  import('@/features/discipline/incident-form-page').then((m) => ({ default: m.IncidentFormPage })),
);
const IncidentDetailPage = lazy(() =>
  import('@/features/discipline/incident-detail-page').then((m) => ({
    default: m.IncidentDetailPage,
  })),
);
const CollectionPage = lazy(() =>
  import('@/features/collection/collection-page').then((m) => ({ default: m.CollectionPage })),
);

/* -- Communication --------------------------------------------------------- */
const MessagesPage = lazy(() =>
  import('@/features/messaging/messages-page').then((m) => ({ default: m.MessagesPage })),
);
const AnnouncementsPage = lazy(() =>
  import('@/features/announcements/announcements-page').then((m) => ({
    default: m.AnnouncementsPage,
  })),
);
const AnnouncementFormPage = lazy(() =>
  import('@/features/announcements/announcement-form-page').then((m) => ({
    default: m.AnnouncementFormPage,
  })),
);
const NewsPage = lazy(() =>
  import('@/features/news/news-page').then((m) => ({ default: m.NewsPage })),
);
const NewsDetailPage = lazy(() =>
  import('@/features/news/news-detail-page').then((m) => ({ default: m.NewsDetailPage })),
);

/* -- Administration -------------------------------------------------------- */
const SchoolSettingsPage = lazy(() =>
  import('@/features/settings/school-settings-page').then((m) => ({
    default: m.SchoolSettingsPage,
  })),
);
const AcademicsSettingsPage = lazy(() =>
  import('@/features/settings/academics-settings-page').then((m) => ({
    default: m.AcademicsSettingsPage,
  })),
);
const GradingSettingsPage = lazy(() =>
  import('@/features/settings/grading-settings-page').then((m) => ({
    default: m.GradingSettingsPage,
  })),
);
const RolesSettingsPage = lazy(() =>
  import('@/features/settings/roles-settings-page').then((m) => ({ default: m.RolesSettingsPage })),
);
const WebsiteSettingsPage = lazy(() =>
  import('@/features/settings/website-settings-page').then((m) => ({
    default: m.WebsiteSettingsPage,
  })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/audit-page').then((m) => ({ default: m.AuditPage })),
);

/* -- Parent portal & profile ----------------------------------------------- */
const FamilyPage = lazy(() =>
  import('@/features/family/family-page').then((m) => ({ default: m.FamilyPage })),
);
const FamilyFinancePage = lazy(() =>
  import('@/features/family/family-finance-page').then((m) => ({ default: m.FamilyFinancePage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/profile-page').then((m) => ({ default: m.ProfilePage })),
);
const NotificationSettingsPage = lazy(() =>
  import('@/features/profile/notification-settings-page').then((m) => ({
    default: m.NotificationSettingsPage,
  })),
);

/** Wraps a subtree in a route-level permission check. */
function guarded(requirement: PermissionRequirement) {
  return (
    <RequirePermission require={requirement}>
      <Outlet />
    </RequirePermission>
  );
}

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/verify/:code', element: <VerifyPage /> },
  { path: '/s/:slug', element: <SchoolWebsitePage /> },
  { path: '/onboarding', element: <OnboardingPage /> },

  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },

      {
        element: guarded('analytics.read'),
        children: [{ path: 'analytics', element: <AnalyticsPage /> }],
      },
      {
        element: guarded('analytics.retention'),
        children: [{ path: 'analytics/retention', element: <RetentionPage /> }],
      },

      /* People --------------------------------------------------------- */
      {
        element: guarded('student.create'),
        children: [{ path: 'students/new', element: <StudentFormPage /> }],
      },
      {
        element: guarded('student.update'),
        children: [{ path: 'students/:id/edit', element: <StudentFormPage /> }],
      },
      {
        element: guarded('student.read'),
        children: [
          { path: 'students', element: <StudentsListPage /> },
          { path: 'students/:id', element: <StudentDetailPage /> },
        ],
      },
      {
        element: guarded('guardian.manage'),
        children: [
          { path: 'guardians/new', element: <GuardianFormPage /> },
          { path: 'guardians/:id/edit', element: <GuardianFormPage /> },
        ],
      },
      {
        element: guarded('guardian.read'),
        children: [
          { path: 'guardians', element: <GuardiansListPage /> },
          { path: 'guardians/:id', element: <GuardianDetailPage /> },
        ],
      },
      {
        element: guarded('staff.manage'),
        children: [
          { path: 'staff/new', element: <StaffFormPage /> },
          { path: 'staff/:id/edit', element: <StaffFormPage /> },
        ],
      },
      {
        element: guarded('staff.read'),
        children: [
          { path: 'staff', element: <StaffListPage /> },
          { path: 'staff/:id', element: <StaffDetailPage /> },
        ],
      },
      {
        element: guarded('admission.manage'),
        children: [{ path: 'admissions/new', element: <AdmissionFormPage /> }],
      },
      {
        element: guarded('admission.read'),
        children: [
          { path: 'admissions', element: <AdmissionsListPage /> },
          { path: 'admissions/:id', element: <AdmissionDetailPage /> },
        ],
      },
      {
        element: guarded('import.run'),
        children: [{ path: 'import', element: <ImportPage /> }],
      },

      /* Teaching ------------------------------------------------------- */
      {
        element: guarded('attendance.read'),
        children: [{ path: 'attendance', element: <AttendancePage /> }],
      },
      {
        element: guarded('timetable.read'),
        children: [{ path: 'timetable', element: <TimetablePage /> }],
      },
      {
        element: guarded('curriculum.read'),
        children: [
          { path: 'curriculum', element: <CurriculumListPage /> },
          { path: 'curriculum/:id', element: <CurriculumDetailPage /> },
        ],
      },
      {
        element: guarded('scheme.read'),
        children: [
          { path: 'schemes', element: <SchemesPage /> },
          { path: 'schemes/:id', element: <SchemeDetailPage /> },
        ],
      },
      {
        element: guarded('lessonnote.read'),
        children: [
          { path: 'lesson-notes', element: <LessonNotesPage /> },
          { path: 'lesson-notes/new', element: <LessonNoteFormPage /> },
          { path: 'lesson-notes/:id', element: <LessonNoteFormPage /> },
        ],
      },
      {
        element: guarded('calendar.read'),
        children: [{ path: 'calendar', element: <CalendarPage /> }],
      },

      /* Assessment ----------------------------------------------------- */
      {
        element: guarded('result.enter'),
        children: [
          { path: 'results/entry', element: <ScoreEntryPage /> },
          { path: 'results/entry/:id', element: <ScoreSheetPage /> },
        ],
      },
      {
        element: guarded('result.read'),
        children: [{ path: 'results', element: <ResultsPage /> }],
      },
      {
        element: guarded('reportcard.read'),
        children: [
          { path: 'report-cards', element: <ReportCardsPage /> },
          { path: 'report-cards/:studentId/:termId', element: <ReportCardPage /> },
        ],
      },
      {
        element: guarded('transcript.read'),
        children: [
          { path: 'transcripts', element: <TranscriptsPage /> },
          { path: 'transcripts/:studentId', element: <TranscriptPage /> },
        ],
      },
      {
        element: guarded('question.manage'),
        children: [{ path: 'cbt/questions', element: <QuestionBankPage /> }],
      },
      {
        element: guarded({ anyOf: ['cbt.read', 'cbt.take'] }),
        children: [
          { path: 'cbt', element: <AssessmentsPage /> },
          { path: 'cbt/attempts/:attemptId', element: <AttemptPage /> },
          { path: 'cbt/:id', element: <AssessmentDetailPage /> },
        ],
      },

      /* Finance -------------------------------------------------------- */
      {
        element: guarded('fee.manage'),
        children: [{ path: 'finance/fees', element: <FeesPage /> }],
      },
      {
        element: guarded('invoice.manage'),
        children: [
          { path: 'finance/invoices/new', element: <InvoiceFormPage /> },
          { path: 'finance/invoices', element: <InvoicesPage /> },
          { path: 'finance/invoices/:id', element: <InvoiceDetailPage /> },
        ],
      },
      {
        element: guarded('payment.manage'),
        children: [
          { path: 'finance/payments/new', element: <PaymentFormPage /> },
          { path: 'finance/payments', element: <PaymentsPage /> },
        ],
      },
      {
        element: guarded('finance.read'),
        children: [
          { path: 'finance', element: <FinanceOverviewPage /> },
          { path: 'finance/debtors', element: <DebtorsPage /> },
          { path: 'finance/receipts/:paymentId', element: <ReceiptPage /> },
        ],
      },

      /* Behaviour & safety --------------------------------------------- */
      {
        element: guarded('behaviour.read'),
        children: [{ path: 'behaviour', element: <BehaviourPage /> }],
      },
      {
        element: guarded('house.read'),
        children: [{ path: 'houses', element: <HousesPage /> }],
      },
      {
        element: guarded('discipline.manage'),
        children: [{ path: 'discipline/new', element: <IncidentFormPage /> }],
      },
      {
        element: guarded('discipline.read'),
        children: [
          { path: 'discipline', element: <DisciplineListPage /> },
          { path: 'discipline/:id', element: <IncidentDetailPage /> },
        ],
      },
      {
        element: guarded('collection.read'),
        children: [{ path: 'collection', element: <CollectionPage /> }],
      },

      /* Communication --------------------------------------------------- */
      {
        element: guarded('message.read'),
        children: [
          { path: 'messages', element: <MessagesPage /> },
          { path: 'messages/:id', element: <MessagesPage /> },
        ],
      },
      {
        element: guarded('announcement.manage'),
        children: [
          { path: 'announcements/new', element: <AnnouncementFormPage /> },
          { path: 'announcements/:id/edit', element: <AnnouncementFormPage /> },
        ],
      },
      {
        element: guarded('announcement.read'),
        children: [{ path: 'announcements', element: <AnnouncementsPage /> }],
      },
      { path: 'news', element: <NewsPage /> },
      { path: 'news/:id', element: <NewsDetailPage /> },

      /* Administration -------------------------------------------------- */
      {
        element: guarded('academics.manage'),
        children: [{ path: 'settings/academics', element: <AcademicsSettingsPage /> }],
      },
      {
        element: guarded('grading.manage'),
        children: [{ path: 'settings/grading', element: <GradingSettingsPage /> }],
      },
      {
        element: guarded('role.manage'),
        children: [{ path: 'settings/roles', element: <RolesSettingsPage /> }],
      },
      {
        element: guarded('settings.manage'),
        children: [
          { path: 'settings', element: <SchoolSettingsPage /> },
          { path: 'settings/website', element: <WebsiteSettingsPage /> },
        ],
      },
      {
        element: guarded('audit.read'),
        children: [{ path: 'audit', element: <AuditPage /> }],
      },

      /* Parent portal & profile ----------------------------------------- */
      { path: 'family', element: <FamilyPage /> },
      { path: 'family/finance', element: <FamilyFinancePage /> },
      { path: 'family/:studentId', element: <FamilyPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'profile/notifications', element: <NotificationSettingsPage /> },

      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);

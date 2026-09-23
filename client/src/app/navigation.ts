import {
  Activity,
  AlarmClock,
  BadgeCheck,
  BarChart3,
  BookMarked,
  BookOpen,
  Building2,
  Bus,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Gavel,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Megaphone,
  Newspaper,
  NotebookPen,
  Paperclip,
  Receipt,
  ScrollText,
  Send,
  Settings,
  Shield,
  Sparkles,
  Table2,
  Target,
  Trophy,
  UploadCloud,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { PermissionRequirement } from '@/lib/permissions';
import type { PersonaKey } from '@/types/rbac';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof Home;
  require?: PermissionRequirement;
  /** Restrict the entry to particular personas even when permitted. */
  personas?: PersonaKey[];
  /**
   * Only for the people who may activate schools (`user.canManageSubscriptions`).
   * Not a permission: those are granted per school, and this is not that.
   */
  subscriptionAdminOnly?: boolean;
  end?: boolean;
  badgeKey?: 'messages' | 'notifications' | 'outbox';
}

/** Whether this entry is one the person may be shown, given what they hold. */
export function isNavItemVisible(
  item: Pick<NavItem, 'subscriptionAdminOnly'>,
  user: { canManageSubscriptions: boolean } | null,
): boolean {
  return !item.subscriptionAdminOnly || Boolean(user?.canManageSubscriptions);
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  personas?: PersonaKey[];
}

/**
 * The whole navigation tree, in one place.
 *
 * Sections and items are filtered by permission at render time, so a bursar,
 * a form teacher and a parent each get a sidebar that contains only what they
 * can actually use — no dead links, no "access denied" surprises.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
      {
        label: 'My children',
        to: '/family',
        icon: Heart,
        personas: ['parent'],
      },
      {
        label: 'Analytics',
        to: '/analytics',
        icon: BarChart3,
        require: 'analytics.read',
        personas: ['admin', 'bursar'],
        end: true,
      },
      {
        label: 'Retention risk',
        to: '/analytics/retention',
        icon: Activity,
        require: 'analytics.retention',
        personas: ['admin'],
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Students', to: '/students', icon: Users, require: { allOf: ['student.read', 'academics.read'] } },
      { label: 'Guardians', to: '/guardians', icon: Heart, require: 'guardian.read' },
      { label: 'Staff', to: '/staff', icon: UserCog, require: 'staff.read' },
      { label: 'Admissions', to: '/admissions', icon: BadgeCheck, require: 'admission.read' },
      { label: 'Bulk import', to: '/import', icon: UploadCloud, require: 'import.run' },
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching',
    items: [
      { label: 'Attendance', to: '/attendance', icon: ClipboardCheck, require: 'attendance.manage' },
      { label: 'Timetable', to: '/timetable', icon: AlarmClock, require: 'timetable.read' },
      { label: 'Curriculum', to: '/curriculum', icon: Target, require: 'curriculum.read' },
      { label: 'Schemes of work', to: '/schemes', icon: ListChecks, require: 'scheme.read' },
      { label: 'Lesson notes', to: '/lesson-notes', icon: NotebookPen, require: 'lessonnote.read' },
      { label: 'Calendar', to: '/calendar', icon: CalendarDays, require: 'calendar.read' },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    items: [
      { label: 'Score entry', to: '/results/entry', icon: Table2, require: 'result.enter' },
      { label: 'Results', to: '/results', icon: ScrollText, require: { allOf: ['result.read', 'academics.read'] } },
      { label: 'Report cards', to: '/report-cards', icon: FileText, require: { allOf: ['reportcard.read', 'academics.read'] } },
      { label: 'Transcripts', to: '/transcripts', icon: GraduationCap, require: 'transcript.read' },
      { label: 'Question bank', to: '/cbt/questions', icon: BookMarked, require: 'question.manage' },
      { label: 'CBT', to: '/cbt', icon: BookOpen, require: { anyOf: ['cbt.read', 'cbt.take'] } },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { label: 'Overview', to: '/finance', icon: Wallet, require: 'analytics.read' },
      { label: 'Fees', to: '/finance/fees', icon: Coins, require: 'fee.manage' },
      { label: 'Invoices', to: '/finance/invoices', icon: Receipt, require: 'invoice.manage' },
      // Hidden for now — see the note above the "Create a custom bill" quick action below.
      // { label: 'Custom bills', to: '/finance/custom-bills', icon: FilePlus2, require: 'invoice.manage' },
      { label: 'Payments', to: '/finance/payments', icon: CreditCard, require: 'payment.manage' },
      {
        label: 'Payment receipts',
        to: '/finance/payment-receipts',
        icon: Paperclip,
        require: 'payment.manage',
      },
      {
        label: 'Documents sent',
        to: '/finance/deliveries',
        icon: Send,
        require: { anyOf: ['payment.manage', 'invoice.manage'] },
      },
      { label: 'Debtors', to: '/finance/debtors', icon: Landmark, require: 'analytics.read' },
      {
        label: 'Fees & payments',
        to: '/family/finance',
        icon: Wallet,
        personas: ['parent'],
      },
    ],
  },
  {
    id: 'wellbeing',
    label: 'Behaviour & safety',
    items: [
      { label: 'Behaviour', to: '/behaviour', icon: Sparkles, require: 'behaviour.read' },
      { label: 'Houses', to: '/houses', icon: Trophy, require: 'house.read' },
      { label: 'Discipline', to: '/discipline', icon: Gavel, require: 'discipline.read' },
      { label: 'Child collection', to: '/collection', icon: Bus, require: 'collection.read' },
    ],
  },
  {
    id: 'engagement',
    label: 'Communication',
    items: [
      {
        label: 'Messages',
        to: '/messages',
        icon: MessageSquare,
        require: 'message.read',
        badgeKey: 'messages',
      },
      {
        label: 'Announcements',
        to: '/announcements',
        icon: Megaphone,
        require: 'announcement.read',
      },
      { label: 'News feed', to: '/news', icon: Newspaper },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { label: 'School settings', to: '/settings', icon: Settings, require: 'settings.manage' },
      { label: 'Academic setup', to: '/settings/academics', icon: ClipboardList, require: 'academics.manage' },
      { label: 'Grading', to: '/settings/grading', icon: FileSpreadsheet, require: 'grading.manage' },
      { label: 'Roles & access', to: '/settings/roles', icon: Shield, require: 'role.manage' },
      { label: 'Website', to: '/settings/website', icon: Newspaper, require: 'website.manage' },
      { label: 'Audit trail', to: '/audit', icon: ScrollText, require: 'audit.read' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Schools', to: '/platform/schools', icon: Building2, subscriptionAdminOnly: true },
    ],
  },
];

/** Quick actions offered in the command palette and the "New" menu. */
export interface QuickAction {
  label: string;
  to: string;
  icon: typeof Home;
  require?: PermissionRequirement;
  keywords?: string[];
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Add a student', to: '/students/new', icon: Users, require: 'student.create', keywords: ['enrol', 'register'] },
  { label: 'Take attendance', to: '/attendance', icon: ClipboardCheck, require: 'attendance.manage', keywords: ['register', 'mark'] },
  { label: 'Enter scores', to: '/results/entry', icon: Table2, require: 'result.enter', keywords: ['marks', 'grades'] },
  { label: 'Record a payment', to: '/finance/payments/new', icon: CreditCard, require: 'payment.manage', keywords: ['receipt', 'cash'] },
  { label: 'Create an invoice', to: '/finance/invoices/new', icon: Receipt, require: 'invoice.manage', keywords: ['bill', 'fees'] },
  // Hidden for now, alongside the "Custom bills" sidebar tab above.
  // { label: 'Create a custom bill', to: '/finance/custom-bills', icon: FilePlus2, require: 'invoice.manage', keywords: ['bill', 'contractor', 'visitor', 'one-off'] },
  { label: 'Post an announcement', to: '/announcements/new', icon: Megaphone, require: 'announcement.manage', keywords: ['notice'] },
  { label: 'Import records', to: '/import', icon: UploadCloud, require: 'import.run', keywords: ['excel', 'xlsx', 'spreadsheet', 'bulk'] },
  { label: 'Log an incident', to: '/discipline/new', icon: Gavel, require: 'discipline.manage', keywords: ['behaviour', 'referral'] },
  { label: 'Add a calendar event', to: '/calendar', icon: CalendarDays, require: 'calendar.manage', keywords: ['holiday', 'exam'] },
];

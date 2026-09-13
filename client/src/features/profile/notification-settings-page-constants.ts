import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Gavel,
  Mail,
  // Megaphone, // ANNOUNCEMENT below is commented out — no backend exists yet.
  // MessageSquare, // MESSAGE below is commented out, and so is the SMS channel.
  // Smartphone, // PUSH channel below is commented out — push sending is off for now.
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { NotificationCategory, NotificationChannel } from '@/types/engagement';
/** Fixed option lists shared by `notification-settings-page` and its parts. */

export const CHANNELS: { key: NotificationChannel; label: string; hint: string; icon: typeof Bell }[] = [
  { key: 'IN_APP', label: 'In app', hint: 'The bell in the top bar', icon: Bell },
  // Push is commented out across the app for now (see notifications.service.ts) —
  // toggling it here would promise a device notification the server won't send.
  // { key: 'PUSH', label: 'Push', hint: 'On this device, even when closed', icon: Smartphone },
  { key: 'EMAIL', label: 'Email', hint: 'To your registered address', icon: Mail },
  // SMS has no delivery adapter anywhere in the server (it's a future item in
  // ARCHITECTURE.md's adapter roadmap) — toggling it today would silently do
  // nothing, so it's hidden until one ships.
  // { key: 'SMS', label: 'SMS', hint: 'Where your school sends them', icon: MessageSquare },
];

/**
 * Partial, not a full `Record`: ANNOUNCEMENT and MESSAGE are commented out
 * below because their backend (`engagement.routes.ts`) is an intentional
 * placeholder with no write routes — nothing can ever produce one of these
 * notifications yet. `PreferenceRow` skips any category missing here.
 */
export const CATEGORY_META: Partial<
  Record<NotificationCategory, { label: string; description: string; icon: typeof Bell }>
> = {
  ATTENDANCE: {
    label: 'Attendance',
    description: 'When a child is marked absent without explanation.',
    icon: ClipboardCheck,
  },
  RESULT: {
    label: 'Results',
    description: 'When a term result or report card is published.',
    icon: BookOpen,
  },
  FEE: {
    label: 'Fees',
    description: 'New invoices, payment confirmations and reminders.',
    icon: CreditCard,
  },
  ADMISSION: {
    label: 'Admissions',
    description: 'Application progress, offers and decisions.',
    icon: UserPlus,
  },
  CALENDAR: {
    label: 'Calendar',
    description: 'Upcoming events, meetings and deadlines.',
    icon: CalendarDays,
  },
  // MESSAGE: {
  //   label: 'Messages',
  //   description: 'Replies in your conversations with the school.',
  //   icon: MessageSquare,
  // },
  BEHAVIOUR: {
    label: 'Behaviour',
    description: 'Commendations, house points and concerns.',
    icon: Sparkles,
  },
  COLLECTION: {
    label: 'Child collection',
    description: 'When a child is released to an authorised adult.',
    icon: Gavel,
  },
  // ANNOUNCEMENT: {
  //   label: 'Announcements',
  //   description: 'Notices from the school office.',
  //   icon: Megaphone,
  // },
  SYSTEM: {
    label: 'System',
    description: 'Account and security notices.',
    icon: Bell,
  },
};

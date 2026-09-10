import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Gavel,
  Mail,
  Megaphone,
  MessageSquare,
  Smartphone,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { NotificationCategory, NotificationChannel } from '@/types/engagement';
/** Fixed option lists shared by `notification-settings-page` and its parts. */

export const CHANNELS: { key: NotificationChannel; label: string; hint: string; icon: typeof Bell }[] = [
  { key: 'IN_APP', label: 'In app', hint: 'The bell in the top bar', icon: Bell },
  { key: 'PUSH', label: 'Push', hint: 'On this device, even when closed', icon: Smartphone },
  { key: 'EMAIL', label: 'Email', hint: 'To your registered address', icon: Mail },
  { key: 'SMS', label: 'SMS', hint: 'Where your school sends them', icon: MessageSquare },
];

export const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string; icon: typeof Bell }
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
  MESSAGE: {
    label: 'Messages',
    description: 'Replies in your conversations with the school.',
    icon: MessageSquare,
  },
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
  ANNOUNCEMENT: {
    label: 'Announcements',
    description: 'Notices from the school office.',
    icon: Megaphone,
  },
  SYSTEM: {
    label: 'System',
    description: 'Account and security notices.',
    icon: Bell,
  },
};

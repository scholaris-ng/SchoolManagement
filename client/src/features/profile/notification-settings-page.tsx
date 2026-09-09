import { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
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
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { disablePush, enablePush, pushSupportState, type PushSupportState } from '@/lib/push';
import {
  useNotificationPreferences,
  useRegisterPushToken,
  useUpdateNotificationPreference,
} from '@/features/notifications/api';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
} from '@/types/engagement';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';

const CHANNELS: { key: NotificationChannel; label: string; hint: string; icon: typeof Bell }[] = [
  { key: 'IN_APP', label: 'In app', hint: 'The bell in the top bar', icon: Bell },
  { key: 'PUSH', label: 'Push', hint: 'On this device, even when closed', icon: Smartphone },
  { key: 'EMAIL', label: 'Email', hint: 'To your registered address', icon: Mail },
  { key: 'SMS', label: 'SMS', hint: 'Where your school sends them', icon: MessageSquare },
];

const CATEGORY_META: Record<
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

/**
 * Per-category, per-channel notification preferences.
 *
 * The server is the authority: it holds the preference record and decides what
 * is actually sent. Some notices — a safeguarding or account-security alert —
 * are deliberately not switchable off here.
 */
export function NotificationSettingsPage() {
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreference();

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Notification settings"
        description="Choose what the school tells you about, and how it reaches you."
        breadcrumbs={[{ label: 'My profile', to: '/profile' }, { label: 'Notifications' }]}
      />

      <PushCard />

      {preferences.isPending ? (
        <LoadingState label="Loading your preferences…" />
      ) : preferences.isError ? (
        <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>What you are told about</CardTitle>
            <CardDescription>
              Changes save as you make them. Turning a channel off never hides the notification from
              the bell — it only stops us pushing, emailing or texting you.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {(preferences.data ?? []).map((preference) => (
                <PreferenceRow
                  key={preference.category}
                  preference={preference}
                  saving={update.isPending}
                  onToggle={(channel, enabled) =>
                    update.mutate({ category: preference.category, channel, enabled })
                  }
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Alert tone="info" title="Some notices always reach you">
        Account security and safeguarding notifications are sent regardless of these settings.
      </Alert>
    </PageContainer>
  );
}

function PreferenceRow({
  preference,
  saving,
  onToggle,
}: {
  preference: NotificationPreference;
  saving: boolean;
  onToggle: (channel: NotificationChannel, enabled: boolean) => void;
}) {
  const meta = CATEGORY_META[preference.category];

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
          <meta.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((channel) => {
              const checked = preference.channels[channel.key] ?? false;
              const label = `${meta.label} by ${channel.label}`;
              return (
                <label
                  key={channel.key}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2',
                    saving && 'opacity-70',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <channel.icon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{channel.label}</span>
                      <span className="block text-xs text-muted-foreground">{channel.hint}</span>
                    </span>
                  </span>
                  <Switch
                    data-cy="profile-notification-settings-checked"
                    checked={checked}
                    onCheckedChange={(value) => onToggle(channel.key, value)}
                    aria-label={label}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Push has to be enabled twice: once by the browser (permission) and once by
 * the server (a device token). Both states are shown honestly rather than
 * pretending a switch is all it takes.
 */
function PushCard() {
  const [state, setState] = useState<PushSupportState>('unsupported');
  const [busy, setBusy] = useState(false);
  const register = useRegisterPushToken();

  useEffect(() => {
    setState(pushSupportState());
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const token = await enablePush();
      setState(pushSupportState());
      if (!token) {
        toast.warning('Push notifications were not enabled', {
          description: 'Your browser did not grant permission.',
        });
        return;
      }
      await register.mutateAsync(token);
      toast.success('Push notifications enabled on this device');
    } catch (error) {
      toast.error('We could not enable push notifications', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast.success('This device will no longer receive push notifications');
    } catch (error) {
      toast.error('We could not turn push off', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (state === 'unsupported') {
    return (
      <Alert tone="info" title="Push notifications are not available in this browser" icon={<BellOff />}>
        You will still see everything in the bell at the top of the page.
      </Alert>
    );
  }

  if (state === 'unconfigured') {
    return (
      <Alert tone="info" title="Push notifications are not set up for this deployment" icon={<BellOff />}>
        In-app, email and SMS notifications are unaffected.
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push on this device</CardTitle>
        <CardDescription>
          Push is granted per browser and per device. Enabling it here does not affect your phone,
          or another computer you use.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {state === 'granted' ? (
            <span className="flex items-center gap-2 text-success">
              <Bell className="size-4" aria-hidden="true" />
              This device can receive push notifications.
            </span>
          ) : state === 'denied' ? (
            <span className="flex items-center gap-2 text-warning">
              <BellOff className="size-4" aria-hidden="true" />
              You blocked notifications for this site. Re-allow them in your browser settings first.
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <BellOff className="size-4" aria-hidden="true" />
              Push is not enabled on this device yet.
            </span>
          )}
        </p>

        {state === 'granted' ? (
          <Button data-cy="profile-notification-settings-turn-off-on-this" variant="outline" onClick={() => void disable()} loading={busy}>
            <BellOff />
            Turn off on this device
          </Button>
        ) : (
          <Button data-cy="profile-notification-settings-enable-push" onClick={() => void enable()} loading={busy} disabled={state === 'denied'}>
            <Bell />
            Enable push
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

import { memo, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { disablePush, enablePush, pushSupportState, type PushSupportState } from '@/lib/push';
import {
  useRegisterPushToken,
} from '@/features/notifications/api';
import type { NotificationCategory, NotificationChannel, NotificationPreference } from '@/types/engagement';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { CHANNELS, CATEGORY_META } from './notification-settings-page-constants';

/**
 * Pieces used by `notification-settings-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

/**
 * One row of the preference list.
 *
 * Memoised because toggling one channel re-renders the whole list, and
 * `onToggle` takes the category back out so the page can hold a single stable
 * handler rather than minting one per row.
 */
export const PreferenceRow = memo(function PreferenceRow({
  preference,
  saving,
  onToggle,
}: {
  preference: NotificationPreference;
  saving: boolean;
  onToggle: (
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ) => void;
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
                    onCheckedChange={(value) => onToggle(preference.category, channel.key, value)}
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
});

/**
 * Push has to be enabled twice: once by the browser (permission) and once by
 * the server (a device token). Both states are shown honestly rather than
 * pretending a switch is all it takes.
 */
export function PushCard() {
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

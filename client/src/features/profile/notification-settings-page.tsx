import { useCallback } from 'react';
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from '@/features/notifications/api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PreferenceRow, PushCard } from './notification-settings-page-parts';
import type { NotificationCategory, NotificationChannel } from '@/types/engagement';





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

  // One handler for the whole list rather than one per row, so the memoised
  // rows are not invalidated every time any preference changes.
  const handleToggle = useCallback(
    (category: NotificationCategory, channel: NotificationChannel, enabled: boolean) =>
      update.mutate({ category, channel, enabled }),
    [update],
  );

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
                  onToggle={handleToggle}
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

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Megaphone, Save, Send } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { useClasses } from '@/features/academics/api';
import { useAnnouncement, useSaveAnnouncement } from './api';
import type { Announcement, NotificationChannel } from '@/types/engagement';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Alert, LoadingState } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';

const AUDIENCES: Announcement['audience'][] = [
  'EVERYONE',
  'STAFF',
  'PARENTS',
  'STUDENTS',
  'CLASSES',
];

const CHANNELS: { value: NotificationChannel; label: string; hint: string }[] = [
  { value: 'IN_APP', label: 'In the app', hint: 'Always delivered' },
  { value: 'PUSH', label: 'Push notification', hint: 'To phones that have opted in' },
  { value: 'EMAIL', label: 'Email', hint: 'To recipients with an address on file' },
  { value: 'SMS', label: 'SMS', hint: 'Costs per message' },
];

export function AnnouncementFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existing = useAnnouncement(id);
  const save = useSaveAnnouncement(id);
  const classes = useClasses();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Announcement['audience']>('EVERYONE');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>(['IN_APP']);
  const [publishAt, setPublishAt] = useState('');
  const [pinned, setPinned] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!existing.data) return;
    const announcement = existing.data;
    setTitle(announcement.title);
    setBody(announcement.body);
    setAudience(announcement.audience);
    setClassIds(announcement.classIds);
    setChannels(announcement.channels);
    setPublishAt(announcement.publishAt.slice(0, 16));
    setPinned(announcement.pinned);
    setDirty(false);
  }, [existing.data]);

  const valid =
    title.trim().length > 2 &&
    body.trim().length > 5 &&
    (audience !== 'CLASSES' || classIds.length > 0) &&
    channels.length > 0;

  const submit = async (status: Announcement['status']) => {
    await save.mutateAsync({
      title: title.trim(),
      body: body.trim(),
      audience,
      classIds: audience === 'CLASSES' ? classIds : [],
      channels,
      publishAt: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      pinned,
      status,
    });
    setDirty(false);
    navigate('/announcements');
  };

  return (
    <PageContainer width="narrow">
      <UnsavedChangesGuard when={dirty && !save.isPending} />

      <PageHeader
        title={isEdit ? 'Edit announcement' : 'New announcement'}
        description="Say it once, to exactly the people it concerns."
        breadcrumbs={[
          { label: 'Announcements', to: '/announcements' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        actions={
          <>
            <Button
              data-cy="announcements-announcement-form-save-draft"
              variant="outline"
              onClick={() => void submit('DRAFT')}
              loading={save.isPending}
              disabled={!valid}
            >
              <Save />
              Save draft
            </Button>
            <Button
              data-cy="announcement-form-publish"
              onClick={() => void submit(publishAt ? 'SCHEDULED' : 'PUBLISHED')}
              loading={save.isPending}
              disabled={!valid}
            >
              <Send />
              {publishAt ? 'Schedule' : 'Publish now'}
            </Button>
          </>
        }
      />

      {isEdit && existing.isPending ? (
        <LoadingState label="Loading announcement…" />
      ) : (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={save.error} />

          <div className="space-y-1.5">
            <Label htmlFor="ann-title" required>
              Title
            </Label>
            <Input
              data-cy="ann-title"
              id="ann-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setDirty(true);
              }}
              placeholder="e.g. Mid-term break dates confirmed"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ann-body" required>
              Message
            </Label>
            <Textarea
              data-cy="ann-body"
              id="ann-body"
              rows={8}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setDirty(true);
              }}
              placeholder="Keep it short — most people will read this on a phone."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who and when</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ann-audience" required>
                Audience
              </Label>
              <NativeSelect
                data-cy="ann-audience"
                id="ann-audience"
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value as Announcement['audience']);
                  setDirty(true);
                }}
              >
                {AUDIENCES.map((option) => (
                  <option key={option} value={option}>
                    {humanizeEnum(option)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-publish">Publish at</Label>
              <Input
                data-cy="ann-publish"
                id="ann-publish"
                type="datetime-local"
                value={publishAt}
                onChange={(event) => {
                  setPublishAt(event.target.value);
                  setDirty(true);
                }}
              />
              <p className="text-xs text-muted-foreground">Leave empty to publish immediately.</p>
            </div>
          </div>

          {audience === 'CLASSES' && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Classes</legend>
              <div className="scrollbar-thin grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-2">
                {(classes.data ?? []).map((schoolClass) => (
                  <label key={schoolClass.id} className="flex items-center gap-2 text-sm">
                    <input
                      data-cy="announcement-form-id"
                      type="checkbox"
                      checked={classIds.includes(schoolClass.id)}
                      onChange={() => {
                        setClassIds((current) =>
                          current.includes(schoolClass.id)
                            ? current.filter((entry) => entry !== schoolClass.id)
                            : [...current, schoolClass.id],
                        );
                        setDirty(true);
                      }}
                      className="size-4 rounded border-input"
                    />
                    {schoolClass.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Send through</legend>
            {CHANNELS.map((channel) => (
              <label key={channel.value} className="flex items-start gap-2.5 text-sm">
                <input
                  data-cy="announcement-form-value"
                  type="checkbox"
                  checked={channels.includes(channel.value)}
                  disabled={channel.value === 'IN_APP'}
                  onChange={() => {
                    setChannels((current) =>
                      current.includes(channel.value)
                        ? current.filter((entry) => entry !== channel.value)
                        : [...current, channel.value],
                    );
                    setDirty(true);
                  }}
                  className="mt-0.5 size-4 rounded border-input"
                />
                <span>
                  <span className="block font-medium">{channel.label}</span>
                  <span className="block text-xs text-muted-foreground">{channel.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              data-cy="announcement-form-pinned"
              type="checkbox"
              checked={pinned}
              onChange={(event) => {
                setPinned(event.target.checked);
                setDirty(true);
              }}
              className="size-4 rounded border-input"
            />
            Pin to the top of everyone&rsquo;s list
          </label>

          {channels.includes('SMS') && (
            <Alert tone="warning" title="SMS costs money" icon={<Megaphone />}>
              Every recipient with a phone number on file receives a text. Check the audience before
              publishing.
            </Alert>
          )}

          <Alert tone="info">
            Recipients who have turned a channel off in their own notification settings will not
            receive it there — they always see it in the app.
          </Alert>
        </CardContent>
      </Card>
      </>
      )}
    </PageContainer>
  );
}

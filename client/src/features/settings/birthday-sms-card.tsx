import { useRef, useState } from 'react';
import { Cake, Send } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import type { School } from '@/types/tenant';
import { formatCurrency } from '@/lib/format';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import { Field, Toggle } from './school-settings-page-parts';
import { useRunBirthdayGreetings, useSendTestSms, useSmsStatus } from './api';

/** Mirrors `DEFAULT_BIRTHDAY_SMS_TEMPLATE` on the server, so the box is never empty. */
const DEFAULT_TEMPLATE =
  'Happy birthday, {firstName}! Everyone at {schoolName} wishes you a wonderful day and a great year ahead.';

/**
 * Ready-made wordings, each one SMS page with typical names in. The first is
 * the server's default. Plain GSM characters only — an emoji or curly quote
 * would drop the page limit from 160 characters to 70 and double the cost.
 */
const SAMPLE_TEMPLATES: { label: string; text: string }[] = [
  {
    label: 'Warm and simple',
    text: DEFAULT_TEMPLATE,
  },
  {
    label: 'From the principal',
    text: 'Dear {firstName}, happy birthday from the Principal, staff and pupils of {schoolName}. May this new year bring you joy and success.',
  },
  {
    label: 'Prayerful',
    text: 'Happy birthday, {firstName}! May God bless you with good health, wisdom and many more years. With love from {schoolName}.',
  },
  {
    label: 'For the parent',
    text: 'Dear {guardianName}, {schoolName} joins you in celebrating {firstName} today. Happy birthday to our wonderful pupil!',
  },
  {
    label: 'With their age',
    text: 'Happy birthday, {firstName}! You are {age} today. Your {className} classmates and everyone at {schoolShortName} wish you a fantastic day.',
  },
];

const PLACEHOLDERS = [
  ['{firstName}', "the pupil's first name"],
  ['{fullName}', 'their full name'],
  ['{age}', 'the age they are turning'],
  ['{className}', 'their current class'],
  ['{guardianName}', 'who the phone belongs to, e.g. "Mrs Okoro"'],
  ['{schoolName}', "the school's full name"],
  ['{schoolShortName}', 'its short name'],
] as const;

/** Two SMS pages — the server refuses a longer template. */
const MAX_TEMPLATE_LENGTH = 306;

/**
 * Birthday texts: on or off, when, and what they say.
 *
 * Every send costs the school money, so the card says plainly whether the
 * server can send at all and how much credit is left before anyone switches
 * it on — and the "send now" button is the way to find out what a run does
 * without waiting for tomorrow morning.
 */
export function BirthdaySmsCard({
  school,
  settings,
  onChange,
}: {
  /** For the preview, so it reads with the school's real name. */
  school: Pick<School, 'name' | 'shortName'>;
  settings: Partial<School['settings']> | undefined;
  onChange: (patch: Partial<School['settings']>) => void;
}) {
  const { can } = useAuth();
  const enabled = settings?.birthdaySmsEnabled ?? false;
  // Always asked, so the credit badge in the header is right even while the
  // feature is off — that is when a school decides whether to switch it on.
  const status = useSmsStatus(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const run = useRunBirthdayGreetings();
  const test = useSendTestSms();
  const [testNumber, setTestNumber] = useState('');

  const template = settings?.birthdaySmsTemplate ?? '';
  const effectiveTemplate = template.trim() || DEFAULT_TEMPLATE;
  const pages = smsPageCount(effectiveTemplate);
  const canSend = can('notification.send');
  const credits = status.data?.credits;

  /**
   * Why sending is off right now, in the school's own terms — shown beside
   * the greyed-out buttons rather than leaving them silently inert. Null
   * while the status is still loading, and when sending is possible.
   */
  const blockedReason = !status.data
    ? null
    : !status.data.configured
      ? 'Text messaging is not available yet — the platform is still setting it up.'
      : status.data.credits === 0
        ? `The school has no SMS credit. Ask ${status.data.topUpContact ?? 'the platform administrator'} to top up.`
        : null;
  const blocked = status.isPending || blockedReason !== null;
  const worth = status.data ? formatCurrency(status.data.credits * status.data.unitPriceNgn, 'NGN', { showDecimals: false }) : null;

  /**
   * Drops a placeholder into the message where the cursor is (or at the end),
   * then puts the cursor after it. Typing `{guardianName}` by hand is exactly
   * the kind of thing that gets a letter wrong and reaches a parent as-is.
   */
  const insertPlaceholder = (token: string) => {
    const box = textareaRef.current;
    // An empty box shows the default wording as a placeholder; start from that
    // so clicking a token edits the standard message rather than a blank one.
    const current = template || DEFAULT_TEMPLATE;
    const start = box && template ? box.selectionStart : current.length;
    const end = box && template ? box.selectionEnd : current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const pad = before && !/s$/.test(before) ? ' ' : '';
    const next = `${before}${pad}${token}${after}`.slice(0, MAX_TEMPLATE_LENGTH);
    onChange({ birthdaySmsTemplate: next });
    const caret = Math.min(next.length, before.length + pad.length + token.length);
    requestAnimationFrame(() => {
      box?.focus();
      box?.setSelectionRange(caret, caret);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Cake className="size-4" aria-hidden />
          Birthday messages
          {credits !== undefined && (
            <Badge
              tone={credits === 0 ? 'danger' : 'primary'}
              data-cy="school-settings-sms-credits"
              title="Prepaid SMS credit. One unit is one message page."
            >
              {credits.toLocaleString()} SMS · {worth}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          A text message to each pupil's guardian on the pupil's birthday, sent automatically every
          morning. Each message is one SMS from the school's prepaid credit
          {status.data ? ` (${formatCurrency(status.data.unitPriceNgn, 'NGN', { showDecimals: false })} each)` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="Send birthday text messages"
          description="Every active pupil whose birthday it is, once a day, to their primary contact's number."
          checked={enabled}
          onChange={(value) => onChange({ birthdaySmsEnabled: value })}
        />

        {enabled && (
          <div className="space-y-4 pl-1">
            {status.data && !status.data.configured && (
              <Alert tone="warning" title="Text messaging is not available yet">
                The platform has not finished setting up SMS, so no messages will go out for now. Your
                settings here are kept and will apply as soon as it is ready.
                {status.data.topUpContact ? ` Questions: ${status.data.topUpContact}.` : ''}
              </Alert>
            )}
            {status.data && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">SMS credit: </span>
                  <span className={`font-semibold tabular-nums ${status.data.credits === 0 ? 'text-danger' : ''}`}>
                    {status.data.credits.toLocaleString()} SMS
                  </span>
                  <span className="text-muted-foreground">
                    {' '}· worth {worth} at {formatCurrency(status.data.unitPriceNgn, 'NGN', { showDecimals: false })} each
                  </span>
                </p>
                {status.data.configured && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sending as <span className="font-medium text-foreground">{status.data.senderId}</span> via{' '}
                    {status.data.provider}
                  </p>
                )}
              </div>
            )}
            {status.data && status.data.credits === 0 && (
              <Alert tone="warning" title="No SMS credit left">
                Birthday messages will not be sent until the school's credit is topped up.
                {status.data.topUpContact
                  ? ` Contact ${status.data.topUpContact} to add credit.`
                  : ' Contact the platform administrator to add credit.'}
              </Alert>
            )}

            <Field label="Send at" hint="School-local time. A pupil added later in the day is greeted the next morning of their birthday.">
              <Input
                data-cy="school-settings-birthday-sms-time"
                type="time"
                value={settings?.birthdaySmsSendTime ?? '08:00'}
                onChange={(event) => onChange({ birthdaySmsSendTime: event.target.value })}
                className="w-auto"
              />
            </Field>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Start from a sample</p>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="group"
                aria-label="Sample birthday messages"
                data-cy="school-settings-birthday-samples"
              >
                {SAMPLE_TEMPLATES.map((sample) => {
                  const selected = effectiveTemplate === sample.text;
                  return (
                    <button
                      key={sample.label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange({ birthdaySmsTemplate: sample.text })}
                      className={`rounded-md border p-2.5 text-left text-xs transition-colors ${
                        selected
                          ? 'border-primary bg-primary-subtle'
                          : 'border-input bg-card hover:bg-accent'
                      }`}
                    >
                      <span className={`block font-medium ${selected ? 'text-primary dark:text-white' : 'text-foreground'}`}>
                        {sample.label}
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {previewTemplate(sample.text, school)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Pick one, then change any word below. Placeholders fill in each pupil's own details.
              </p>
            </div>

            <Field
              label="Message"
              hint={`${effectiveTemplate.length} of ${MAX_TEMPLATE_LENGTH} characters · ${pages} SMS per pupil${status.data ? ` (${formatCurrency(pages * status.data.unitPriceNgn, 'NGN', { showDecimals: false })})` : ''}. Leave blank for the standard wording.`}
            >
              <Textarea
                ref={textareaRef}
                data-cy="school-settings-birthday-sms-template"
                value={template}
                placeholder={DEFAULT_TEMPLATE}
                maxLength={MAX_TEMPLATE_LENGTH}
                rows={3}
                onChange={(event) => onChange({ birthdaySmsTemplate: event.target.value || null })}
              />
            </Field>

            <details className="text-xs text-muted-foreground" open>
              <summary className="cursor-pointer select-none">Placeholders — click one to add it to the message</summary>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Insert a placeholder">
                {PLACEHOLDERS.map(([token, meaning]) => (
                  <button
                    key={token}
                    type="button"
                    data-cy={`school-settings-birthday-placeholder-${token.slice(1, -1)}`}
                    title={meaning}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPlaceholder(token)}
                    className="rounded-md border border-input bg-card px-2 py-1 font-mono text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    {token}
                  </button>
                ))}
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                {PLACEHOLDERS.map(([token, meaning]) => (
                  <div key={token} className="contents">
                    <dt className="font-mono">{token}</dt>
                    <dd>{meaning}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2">
                Preview:{' '}
                <span className="italic text-foreground">
                  {previewTemplate(effectiveTemplate, school)}
                </span>
              </p>
            </details>

            {canSend && (
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-2">
                  <Field label="Test number" hint="Sends the message above, as it would read for a pupil, to this number.">
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="0803 123 4567"
                      value={testNumber}
                      onChange={(event) => setTestNumber(event.target.value)}
                      className="w-44"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    loading={test.isPending}
                    disabled={blocked || testNumber.trim().length < 6}
                    title={blockedReason ?? undefined}
                    onClick={() =>
                      test.mutate({
                        to: testNumber,
                        message: previewTemplate(effectiveTemplate, school),
                      })
                    }
                  >
                    <Send aria-hidden /> Send test
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  loading={run.isPending}
                  loadingLabel="Sending…"
                  disabled={blocked}
                  onClick={() => run.mutate()}
                  title={blockedReason ?? 'Sends to anyone whose birthday is today and has not been greeted yet.'}
                >
                  Send today's now
                </Button>
              </div>
            )}
            {canSend && blockedReason && (
              <p className="text-xs text-warning" role="status" data-cy="school-settings-birthday-blocked">
                Sending is switched off: {blockedReason}
              </p>
            )}
            {(run.error || test.error) && (
              <Alert tone="danger" title="Not sent">
                {(run.error ?? test.error)?.message}
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** The template with sample values in, so the wording can be judged before anyone receives it. */
function previewTemplate(template: string, school: Pick<School, 'name' | 'shortName'>): string {
  const sample: Record<string, string> = {
    firstName: 'Ada',
    fullName: 'Ada Chizea Okoro',
    age: '10',
    className: 'Primary 5',
    guardianName: 'Mrs Okoro',
    schoolName: school.name,
    schoolShortName: school.shortName,
  };
  return template.replace(/\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}/g, (match, name: string) => sample[name] ?? match);
}

/**
 * Same arithmetic as `smsPageCount` on the server: 160 GSM-7 characters per
 * page (153 once it spills into several), 70 (67) if any character — an
 * emoji, a curly quote, ₦ — forces the message into UCS-2.
 */
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€';

function smsPageCount(text: string): number {
  let length = 0;
  for (const char of text) {
    if (GSM7.includes(char)) length += 1;
    else if (GSM7_EXTENDED.includes(char)) length += 2;
    else return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
  }
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

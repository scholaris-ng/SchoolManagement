import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CloudOff,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Save,
  Shield,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-bus';
import { useAuth } from '@/app/providers/auth-provider';
import { useTheme, type ThemeMode } from '@/app/providers/theme-provider';
import { useOutbox } from '@/hooks/use-outbox';
import { membershipLabel } from '@/lib/permissions';
import { useUpdateProfile } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/components/forms/file-upload';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Monitor },
];

/**
 * The signed-in user's own account.
 *
 * Roles and permissions are shown but never edited here — a user cannot grant
 * themselves anything. Changing what a role may do belongs to an administrator
 * on the Roles & access screen, and the API enforces that regardless.
 */
export function ProfilePage() {
  const { user, identityUser, memberships, membership, switchSchool, signOut, sendPasswordReset } =
    useAuth();
  const { mode, setMode } = useTheme();
  const outbox = useOutbox();
  const update = useUpdateProfile();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoUrl ?? null);
  const [dirty, setDirty] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setPhone(user.phone ?? '');
    setPhotoUrl(user.photoUrl ?? null);
    setDirty(false);
  }, [user]);

  const save = async () => {
    await update.mutateAsync({ displayName, phone: phone || null, photoUrl });
    setDirty(false);
  };

  const requestReset = async () => {
    const email = user?.email ?? identityUser?.email;
    if (!email) return;
    try {
      await sendPasswordReset(email);
      setResetSent(true);
      toast.success('Check your inbox', { description: `We sent a reset link to ${email}.` });
    } catch (error) {
      toast.error('We could not send that email', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <PageContainer width="narrow">
      <UnsavedChangesGuard when={dirty && !update.isPending} />

      <PageHeader
        title="My profile"
        description="How you appear to the school, and how this app behaves for you."
        breadcrumbs={[{ label: 'My profile' }]}
        actions={
          <Button onClick={() => void save()} loading={update.isPending} disabled={!dirty}>
            <Save />
            Save changes
          </Button>
        }
      />

      <FormError error={update.error} />

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Staff and guardians you correspond with see this name and photograph.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            variant="avatar"
            preset="image"
            purpose="user-photo"
            label="Profile photo"
            description="Optional. Shown beside your messages and in the audit trail."
            value={photoUrl ? { url: photoUrl } : null}
            onUploaded={(file) => {
              setPhotoUrl(file.downloadUrl);
              setDirty(true);
            }}
            onRemove={() => {
              setPhotoUrl(null);
              setDirty(true);
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" required>
                Full name
              </Label>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setDirty(true);
                }}
                placeholder="For SMS alerts, if your school sends them"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user?.email ?? ''} readOnly disabled />
              <p className="text-xs text-muted-foreground">
                Your email address is your sign-in identity. Ask your school administrator if it
                needs to change.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schools and access</CardTitle>
          <CardDescription>
            What you may do is granted per school. You cannot change it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {memberships.map((entry) => {
              const active = entry.schoolId === membership?.schoolId;
              return (
                <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={entry.schoolName} src={entry.branding.logoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.schoolName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {membershipLabel(entry)} · {entry.permissions.length} permission
                      {entry.permissions.length === 1 ? '' : 's'}
                      {entry.branchName ? ` · ${entry.branchName}` : ''}
                    </p>
                  </div>
                  {entry.status !== 'ACTIVE' && <Badge tone="warning">{entry.status}</Badge>}
                  {active ? (
                    <Badge tone="primary">
                      <Check />
                      Active
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => switchSchool(entry.schoolId)}>
                      Switch
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Stored on this device only.</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">Theme</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                    mode === option.value
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-border hover:border-primary/40 hover:bg-accent/40',
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
                    className="sr-only"
                  />
                  <option.icon className="size-4" aria-hidden="true" />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose which alerts reach you, and how — in the app, by push, email or SMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/profile/notifications">
              <Bell />
              Notification settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offline work</CardTitle>
          <CardDescription>
            Registers and scores entered without a connection are held on this device until they
            reach the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {outbox.entries.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="size-4" aria-hidden="true" />
              Everything you have entered has reached the server.
            </p>
          ) : (
            <>
              <Alert
                tone={outbox.entries.some((entry) => entry.status === 'conflict') ? 'danger' : 'warning'}
                title={`${outbox.pendingCount} change${outbox.pendingCount === 1 ? '' : 's'} still on this device`}
                icon={<CloudOff />}
              >
                Do not clear this browser&rsquo;s data until these have synchronised.
              </Alert>
              <Button
                variant="outline"
                onClick={outbox.retryNow}
                loading={outbox.isFlushing}
                disabled={!outbox.isOnline}
              >
                Try to sync now
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                We email you a link rather than asking for your current password.
              </p>
            </div>
            <Button variant="outline" onClick={() => void requestReset()} disabled={resetSent}>
              <KeyRound />
              {resetSent ? 'Reset link sent' : 'Send reset link'}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">
                Ends this session and clears cached school data from this device.
              </p>
            </div>
            <Button variant="outline" onClick={() => setSignOutOpen(true)}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 pt-5 text-sm text-muted-foreground">
          <Shield className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            This school holds records about children. Sign out on shared devices, and never pass on
            your sign-in details — every action taken with your account is recorded against your
            name in the audit trail.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out?"
        description={
          outbox.pendingCount > 0
            ? `You have ${outbox.pendingCount} change${outbox.pendingCount === 1 ? '' : 's'} that have not reached the server yet. Signing out now may lose them.`
            : 'You will need to sign in again to use the portal.'
        }
        confirmLabel="Sign out"
        tone={outbox.pendingCount > 0 ? 'danger' : 'primary'}
        onConfirm={() => signOut()}
      />
    </PageContainer>
  );
}

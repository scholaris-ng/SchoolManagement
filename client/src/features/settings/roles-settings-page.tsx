import { useEffect, useMemo, useState } from 'react';
import { Lock, Save, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useRoles, useSaveRole } from './api';
import type { Permission, Role } from '@/types/rbac';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { SettingsTabs } from './settings-tabs';

/**
 * Permissions, grouped the way an administrator thinks about them.
 *
 * Roles are only names; every authorisation decision in the product is made
 * against a *permission*, which is why a school can invent "Head of Lower
 * School" and have the navigation, the guards and the API all behave correctly
 * (spec section 5).
 */
const PERMISSION_GROUPS: {
  id: string;
  label: string;
  description: string;
  permissions: { key: Permission; label: string; hint?: string }[];
}[] = [
  {
    id: 'school',
    label: 'School & platform',
    description: 'Configuration that affects everyone at the school.',
    permissions: [
      { key: 'school.read', label: 'View school profile' },
      { key: 'school.manage', label: 'Edit school profile' },
      { key: 'settings.manage', label: 'Manage school settings' },
      { key: 'branding.manage', label: 'Manage branding' },
      { key: 'role.manage', label: 'Manage roles and access', hint: 'Can grant any permission' },
      { key: 'audit.read', label: 'Read the audit trail' },
      { key: 'website.manage', label: 'Manage the public website' },
    ],
  },
  {
    id: 'academics',
    label: 'Academic structure',
    description: 'Sessions, terms, levels, classes and subjects.',
    permissions: [
      { key: 'academics.read', label: 'View academic structure' },
      { key: 'academics.manage', label: 'Manage academic structure' },
      { key: 'grading.manage', label: 'Configure grading schemes' },
      { key: 'timetable.read', label: 'View timetable' },
      { key: 'timetable.manage', label: 'Manage timetable' },
      { key: 'calendar.read', label: 'View calendar' },
      { key: 'calendar.manage', label: 'Manage calendar' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    description: 'Students, guardians and staff records.',
    permissions: [
      { key: 'student.read', label: 'View students' },
      { key: 'student.create', label: 'Register students' },
      { key: 'student.update', label: 'Edit students' },
      { key: 'student.delete', label: 'Delete students' },
      { key: 'student.promote', label: 'Promote and transfer students' },
      { key: 'guardian.read', label: 'View guardians' },
      { key: 'guardian.manage', label: 'Manage guardians' },
      { key: 'staff.read', label: 'View staff' },
      { key: 'staff.manage', label: 'Manage staff' },
      { key: 'import.run', label: 'Run bulk imports' },
    ],
  },
  {
    id: 'admissions',
    label: 'Admissions',
    description: 'Applications through to enrolment.',
    permissions: [
      { key: 'admission.read', label: 'View applications' },
      { key: 'admission.manage', label: 'Manage applications' },
      { key: 'admission.decide', label: 'Offer, accept and reject' },
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching',
    description: 'Attendance, curriculum and lesson planning.',
    permissions: [
      { key: 'attendance.read', label: 'View attendance' },
      { key: 'attendance.manage', label: 'Take and correct registers' },
      { key: 'curriculum.read', label: 'View curriculum' },
      { key: 'curriculum.manage', label: 'Manage curriculum' },
      { key: 'scheme.read', label: 'View schemes of work' },
      { key: 'scheme.manage', label: 'Write schemes of work' },
      { key: 'scheme.approve', label: 'Approve schemes of work' },
      { key: 'lessonnote.read', label: 'View lesson notes' },
      { key: 'lessonnote.manage', label: 'Write lesson notes' },
      { key: 'lessonnote.approve', label: 'Approve lesson notes' },
    ],
  },
  {
    id: 'results',
    label: 'Assessment & results',
    description: 'Score entry through to publication.',
    permissions: [
      { key: 'result.read', label: 'View results' },
      { key: 'result.enter', label: 'Enter scores' },
      { key: 'result.approve', label: 'Approve results' },
      { key: 'result.publish', label: 'Publish results' },
      {
        key: 'result.amend',
        label: 'Amend published results',
        hint: 'Every change is audited',
      },
      { key: 'reportcard.read', label: 'View report cards' },
      { key: 'reportcard.generate', label: 'Generate report cards' },
      { key: 'transcript.read', label: 'View transcripts' },
      { key: 'transcript.issue', label: 'Issue transcripts' },
      { key: 'cbt.read', label: 'View assessments' },
      { key: 'cbt.manage', label: 'Manage assessments' },
      { key: 'cbt.take', label: 'Sit assessments' },
      { key: 'question.manage', label: 'Manage the question bank' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Fees, invoices and payments.',
    permissions: [
      { key: 'finance.read', label: 'View finance' },
      { key: 'fee.manage', label: 'Manage fee items and structures' },
      { key: 'invoice.manage', label: 'Create and adjust invoices' },
      { key: 'payment.manage', label: 'Record payments' },
      { key: 'payment.reconcile', label: 'Reconcile payments' },
      { key: 'discount.manage', label: 'Manage discounts and scholarships' },
    ],
  },
  {
    id: 'wellbeing',
    label: 'Behaviour & safety',
    description: 'Behaviour, discipline, houses and child collection.',
    permissions: [
      { key: 'behaviour.read', label: 'View behaviour' },
      { key: 'behaviour.manage', label: 'Record behaviour' },
      { key: 'behaviour.configure', label: 'Configure traits and scales' },
      { key: 'discipline.read', label: 'View discipline records' },
      { key: 'discipline.manage', label: 'Log incidents' },
      { key: 'discipline.review', label: 'Review and resolve incidents' },
      { key: 'house.read', label: 'View houses' },
      { key: 'house.manage', label: 'Manage houses and points' },
      { key: 'collection.read', label: 'View child collection' },
      { key: 'collection.manage', label: 'Release children' },
    ],
  },
  {
    id: 'engagement',
    label: 'Communication',
    description: 'Messaging, announcements and the news feed.',
    permissions: [
      { key: 'message.read', label: 'Read messages' },
      { key: 'message.send', label: 'Send messages' },
      { key: 'announcement.read', label: 'Read announcements' },
      { key: 'announcement.manage', label: 'Publish announcements' },
      { key: 'news.manage', label: 'Manage the news feed' },
      { key: 'notification.send', label: 'Send notifications' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Management reporting.',
    permissions: [
      { key: 'analytics.read', label: 'View analytics' },
      { key: 'analytics.staff', label: 'View staff performance' },
      { key: 'analytics.retention', label: 'View retention risk' },
    ],
  },
];

export function RolesSettingsPage() {
  const { membership } = useAuth();
  const roles = useRoles();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => roles.data ?? [], [roles.data]);
  const selected = list.find((role) => role.id === selectedId) ?? list[0] ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Roles & access"
        description="What each role may do. Roles are convenience; permissions are what the server actually checks."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles & access' }]}
      />

      <SettingsTabs />

      {roles.isPending ? (
        <LoadingState label="Loading roles…" />
      ) : roles.isError ? (
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Shield />}
          title="No roles defined yet"
          description="Your school has no roles configured. Contact support if you expected the default set."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Roles" className="space-y-1">
            {list.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedId(role.id)}
                aria-current={selected?.id === role.id ? 'true' : undefined}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  selected?.id === role.id
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
                )}
              >
                <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{role.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? '' : 's'}
                    {role.memberCount !== undefined ? ` · ${role.memberCount} member${role.memberCount === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                {role.isSystem && (
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Built-in role" />
                )}
              </button>
            ))}
          </nav>

          {selected && (
            <RoleEditor
              key={selected.id}
              role={selected}
              /* Editing your own role can lock you out; warn rather than block, since
                 another administrator may legitimately need the change made. */
              isOwnRole={Boolean(
                membership?.roles.some((name) => name === selected.key) ||
                  membership?.customRoleNames.includes(selected.name),
              )}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}

function RoleEditor({ role, isOwnRole }: { role: Role; isOwnRole: boolean }) {
  const save = useSaveRole(role.id);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [granted, setGranted] = useState<Set<Permission>>(() => new Set(role.permissions));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(role.name);
    setDescription(role.description ?? '');
    setGranted(new Set(role.permissions));
    setDirty(false);
  }, [role]);

  const toggle = (permission: Permission) => {
    setGranted((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
    setDirty(true);
  };

  const toggleGroup = (permissions: Permission[], enable: boolean) => {
    setGranted((current) => {
      const next = new Set(current);
      permissions.forEach((permission) => (enable ? next.add(permission) : next.delete(permission)));
      return next;
    });
    setDirty(true);
  };

  const submit = async () => {
    await save.mutateAsync({
      name: role.isSystem ? undefined : name,
      description: role.isSystem ? undefined : description,
      permissions: Array.from(granted),
    });
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      <UnsavedChangesGuard when={dirty && !save.isPending} />

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              {role.name}
              {role.isSystem && <Badge tone="neutral">Built-in</Badge>}
            </CardTitle>
            <CardDescription>
              {role.isSystem
                ? 'A built-in role. Its name is fixed, but you can still change what it may do.'
                : 'A role your school created. Rename it or change what it may do.'}
            </CardDescription>
          </div>
          <Button onClick={() => void submit()} loading={save.isPending} disabled={!dirty}>
            <Save />
            Save role
          </Button>
        </CardHeader>

        {!role.isSystem && (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name" required>
                Role name
              </Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setDirty(true);
                }}
                placeholder="Who this role is for"
              />
            </div>
          </CardContent>
        )}
      </Card>

      <FormError error={save.error} />

      {isOwnRole && (
        <Alert tone="warning" title="This is one of your own roles">
          Removing a permission here takes it away from you as well. You may not be able to return
          to this screen afterwards.
        </Alert>
      )}

      {granted.has('platform.manage') && (
        <Alert tone="danger" title="Platform operator role">
          <code>platform.manage</code> implies every other permission. Grant it only to the people
          who run the platform itself.
        </Alert>
      )}

      {PERMISSION_GROUPS.map((group) => {
        const keys = group.permissions.map((permission) => permission.key);
        const grantedCount = keys.filter((key) => granted.has(key)).length;
        const allOn = grantedCount === keys.length;

        return (
          <Card key={group.id}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-sm">{group.label}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {grantedCount}/{keys.length}
                </span>
                <Button variant="ghost" size="sm" onClick={() => toggleGroup(keys, !allOn)}>
                  {allOn ? 'Clear all' : 'Select all'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <label
                  key={permission.key}
                  className="flex cursor-pointer items-start gap-2.5 rounded py-1"
                >
                  <Checkbox
                    checked={granted.has(permission.key)}
                    onCheckedChange={() => toggle(permission.key)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{permission.label}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {permission.key}
                    </span>
                    {permission.hint && (
                      <span className="block text-xs text-warning">{permission.hint}</span>
                    )}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="flex items-start gap-3 pt-5 text-sm text-muted-foreground">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Hiding a control in this app is a courtesy, not a lock. The API re-checks every one of
            these permissions on every request, so a user who works around the interface still gets
            nothing they were not granted here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Save, Users } from 'lucide-react';
import { useSaveRole } from './api';
import type { Permission, Role } from '@/types/rbac';
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
import { Alert } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { PERMISSION_GROUPS } from './roles-settings-page-constants';

/**
 * Pieces used by `roles-settings-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function RoleEditor({ role, isOwnRole }: { role: Role; isOwnRole: boolean }) {
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
          <Button data-cy="settings-roles-settings-save-role" onClick={() => void submit()} loading={save.isPending} disabled={!dirty}>
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
                data-cy="role-name"
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
                data-cy="role-description"
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
                <Button
                  variant="ghost"
                  size="sm"
                  data-cy={`roles-toggle-group-${group}`}
                  onClick={() => toggleGroup(keys, !allOn)}
                >
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
                    data-cy="roles-settings-key"
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

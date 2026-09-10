import { useMemo, useState } from 'react';
import { Lock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useRoles } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { SettingsTabs } from './settings-tabs';
import { RoleEditor } from './roles-settings-page-parts';

/**
 * Permissions, grouped the way an administrator thinks about them.
 *
 * Roles are only names; every authorisation decision in the product is made
 * against a *permission*, which is why a school can invent "Head of Lower
 * School" and have the navigation, the guards and the API all behave correctly
 * (spec section 5).
 */


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
                data-cy="settings-roles-settings-permission-role-membercount-undefined"
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

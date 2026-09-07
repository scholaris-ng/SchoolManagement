import { useAuth } from '@/app/providers/auth-provider';
import { PageTabs } from '@/components/layout/page-header';

/**
 * Shared navigation across the administration screens, filtered by permission
 * so a bursar with `settings.manage` but not `role.manage` never sees a tab
 * that would refuse them.
 */
export function SettingsTabs() {
  const { can } = useAuth();

  const items = [
    { label: 'School', to: '/settings', end: true, show: can('settings.manage') },
    { label: 'Academic setup', to: '/settings/academics', show: can('academics.manage') },
    { label: 'Grading', to: '/settings/grading', show: can('grading.manage') },
    { label: 'Roles & access', to: '/settings/roles', show: can('role.manage') },
    { label: 'Website', to: '/settings/website', show: can('settings.manage') },
    { label: 'Audit trail', to: '/audit', show: can('audit.read') },
  ].filter((item) => item.show);

  if (items.length <= 1) return null;

  return <PageTabs items={items.map(({ label, to, end }) => ({ label, to, end }))} />;
}

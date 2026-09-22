import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { School } from '@/types/tenant';
import type { WebsiteContent } from '@/types/engagement';
import type { ListQuery } from '@/types/api';
import { SettingsEndpoints } from './settings.endpoints';
import type { SaveRoleInput } from './settings.endpoints';

export type { SaveRoleInput };

export function useSchool() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.school.detail(schoolId),
    queryFn: () => SettingsEndpoints.fetchSchool(),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60_000,
  });
}

/** Saves school settings under optimistic locking. */
export function useUpdateSchool() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ values, version }: { values: Partial<School>; version: number }) =>
      SettingsEndpoints.updateSchool(values, version),
    onSuccess: (school) => {
      queryClient.setQueryData(queryKeys.school.detail(schoolId), school);
      // Branding lives on the membership too, so the shell re-skins immediately.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('School settings saved');
    },
  });
}

export function useRoles() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.roles.list(schoolId),
    queryFn: () => SettingsEndpoints.fetchRoles(),
    enabled: Boolean(schoolId),
  });
}

export function useSaveRole(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: SaveRoleInput) =>
      id ? SettingsEndpoints.updateRole(id, values) : SettingsEndpoints.createRole(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(schoolId) });
      // Anyone holding this role has a different permission set from now on.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Role saved');
    },
  });
}

export function useWebsite() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.school.website(schoolId),
    queryFn: () => SettingsEndpoints.fetchWebsite(),
    enabled: Boolean(schoolId),
  });
}

export function useUpdateWebsite() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<WebsiteContent>) => SettingsEndpoints.updateWebsite(values),
    onSuccess: (website) => {
      queryClient.setQueryData(queryKeys.school.website(schoolId), website);
      toast.success('Website updated');
    },
  });
}

export function useAuditLog(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.audit.list(schoolId, query),
    queryFn: () => SettingsEndpoints.fetchAuditLog(query),
    enabled: Boolean(schoolId),
  });
}

// ─── Outbound SMS ─────────────────────────────────────────────────────────────

/**
 * Whether the server can send texts at all, and the credit left. Asked only
 * when the birthday card is open (`enabled`): it costs a round trip to the
 * SMS provider, which nobody needs when they came to change the school colour.
 */
export function useSmsStatus(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.school.smsStatus(schoolId),
    queryFn: () => SettingsEndpoints.fetchSmsStatus(),
    enabled: Boolean(schoolId) && enabled,
    staleTime: 60_000,
  });
}

export function useRunBirthdayGreetings() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => SettingsEndpoints.runBirthdayGreetings(),
    onSuccess: (summary) => {
      // Credit was spent, so the balance shown on the card is stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.school.smsStatus(schoolId) });
      if (summary.skippedReason === 'SMS_NOT_CONFIGURED') {
        toast.error('Text messaging is not available right now, so nothing was sent.');
      } else if (summary.skippedReason === 'NO_CREDIT') {
        toast.error('The school has no SMS credit left, so nothing was sent.', {
          description: `${summary.noCredit} pupil${summary.noCredit === 1 ? ' is' : 's are'} waiting to be greeted. Ask the platform administrator to top up.`,
        });
      } else if (summary.celebrants === 0) {
        toast.info('No pupil has a birthday today.');
      } else {
        const notSent = summary.failed + summary.noRecipient + summary.noCredit;
        toast.success(
          `${summary.sent} birthday message${summary.sent === 1 ? '' : 's'} sent` +
            (summary.alreadySent > 0 ? `, ${summary.alreadySent} already sent today` : '') +
            (notSent > 0 ? `, ${notSent} not sent` : '') +
            '.',
          summary.noCredit > 0
            ? { description: `Credit ran out part way: ${summary.noCredit} not sent. They go once the balance is topped up.` }
            : undefined,
        );
      }
    },
  });
}

export function useSendTestSms() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: { to: string; message: string }) => SettingsEndpoints.sendTestSms(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.school.smsStatus(schoolId) });
      toast.success('Test message sent');
    },
  });
}

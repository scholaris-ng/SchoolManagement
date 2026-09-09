import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import { MessagingEndpoints } from './messaging.endpoints';
import type { MessageContact, StartConversationInput } from './messaging.endpoints';

export type { MessageContact, StartConversationInput };

export function useConversations(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.messaging.conversations(schoolId, query),
    queryFn: () => MessagingEndpoints.fetchConversations(query),
    enabled: Boolean(schoolId),
    // Realtime delivery is Firestore's job; this poll keeps the *list* fresh
    // for users whose browser has no Firestore connection.
    refetchInterval: 60_000,
  });
}

export function useMessages(conversationId: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.messaging.conversation(schoolId, conversationId ?? ''),
    queryFn: () => MessagingEndpoints.fetchMessages(conversationId ?? ''),
    enabled: Boolean(schoolId && conversationId),
    refetchInterval: 20_000,
  });
}

/** Who this user is allowed to start a thread with. */
export function useMessageContacts(studentId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.messaging.contacts(schoolId, studentId),
    queryFn: () => MessagingEndpoints.fetchContacts(studentId),
    enabled: Boolean(schoolId),
  });
}

export function useSendMessage(conversationId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => MessagingEndpoints.sendMessage(conversationId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.conversation(schoolId, conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(schoolId),
      });
    },
  });
}

export function useStartConversation() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: StartConversationInput) => MessagingEndpoints.startConversation(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations(schoolId) });
      toast.success('Message sent');
    },
  });
}

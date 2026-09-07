import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type { ChatMessage, Conversation } from '@/types/engagement';

/** A person this user is permitted to open a conversation with. */
export interface MessageContact {
  id: string;
  name: string;
  role: string;
  subjects?: string[];
  photoUrl?: string | null;
}

export function useConversations(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.messaging.conversations(schoolId, query),
    queryFn: () => http.get<Paginated<Conversation>>('/conversations', { query }),
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
    queryFn: () => http.get<ChatMessage[]>(`/conversations/${conversationId}/messages`),
    enabled: Boolean(schoolId && conversationId),
    refetchInterval: 20_000,
  });
}

/**
 * Who this user is allowed to start a thread with.
 *
 * The list comes from the server, derived from the school's messaging policy
 * and the sender's relationship to a child. A parent cannot address arbitrary
 * staff, and no one can enumerate other users (spec section 29).
 */
export function useMessageContacts(studentId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.messaging.contacts(schoolId, studentId),
    queryFn: () => http.get<MessageContact[]>('/message-contacts', { query: { studentId } }),
    enabled: Boolean(schoolId),
  });
}

export function useSendMessage(conversationId: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) =>
      http.post<ChatMessage>(`/conversations/${conversationId}/messages`, { body }),
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
    mutationFn: (input: {
      subject: string;
      recipientIds: string[];
      studentId?: string;
      body: string;
    }) => http.post<Conversation>('/conversations', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations(schoolId) });
      toast.success('Message sent');
    },
  });
}

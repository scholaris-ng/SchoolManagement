import { http } from '@/lib/http';
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

export interface StartConversationInput {
  subject: string;
  recipientIds: string[];
  studentId?: string;
  body: string;
}

/**
 * Endpoint layer for messaging.
 *
 * The contact list comes from the server, derived from the messaging policy
 * and the sender's relationship to a child. A parent cannot address arbitrary
 * staff, and no one can enumerate other users (spec section 29).
 */
export const MessagingEndpoints = {
  fetchConversations: (query: ListQuery) =>
    http.get<Paginated<Conversation>>('/conversations', { query }),

  fetchMessages: (conversationId: string) =>
    http.get<ChatMessage[]>(`/conversations/${conversationId}/messages`),

  fetchContacts: (studentId?: string) =>
    http.get<MessageContact[]>('/message-contacts', { query: { studentId } }),

  sendMessage: (conversationId: string, body: string) =>
    http.post<ChatMessage>(`/conversations/${conversationId}/messages`, { body }),

  startConversation: (input: StartConversationInput) =>
    http.post<Conversation>('/conversations', input),
};

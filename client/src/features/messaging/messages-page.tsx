import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useListQuery } from '@/hooks/use-list-query';
import {
  useConversations,
  useMessages,
  useSendMessage,
} from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Avatar, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { SearchInput, Textarea } from '@/components/ui/input';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { ComposeDialog } from './messages-page-parts';

/**
 * Parent–teacher messaging.
 *
 * Conversations are always *about a child*, which is what keeps the feature
 * safe: a parent can only open a thread with staff connected to their own
 * children, and the recipient list comes from the server, never from the
 * client guessing (spec section 29).
 */
export function MessagesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();

  const list = useListQuery({ defaultPageSize: 30 });
  const conversations = useConversations(list.query);
  const messages = useMessages(id);
  const sendMessage = useSendMessage(id ?? '');

  const [draft, setDraft] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const active = conversations.data?.items.find((conversation) => conversation.id === id);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data]);

  const send = async () => {
    if (!draft.trim() || !id) return;
    const body = draft.trim();
    setDraft('');
    await sendMessage.mutateAsync(body);
  };

  const showList = isDesktop || !id;
  const showThread = isDesktop || Boolean(id);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Messages"
        description="Conversations between staff and the families of the children they teach."
        breadcrumbs={[{ label: 'Communication' }, { label: 'Messages' }]}
        actions={
          <Button data-cy="messaging-messages-new-message" onClick={() => setComposeOpen(true)}>
            <Plus />
            New message
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[20rem,1fr]">
        {showList && (
          <Card className="flex max-h-[70vh] flex-col overflow-hidden">
            <div className="border-b border-border p-3">
              <SearchInput
                data-cy="messaging-messages-search"
                value={list.search}
                onValueChange={list.setSearch}
                placeholder="Search conversations…"
              />
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {conversations.isPending ? (
                <LoadingState label="Loading…" />
              ) : (conversations.data?.items.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={<MessageSquare />}
                  title="No conversations"
                  description="Start one with a teacher or a parent."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {conversations.data?.items.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        data-cy="messaging-messages-conversation-unreadcount-0-conversation"
                        type="button"
                        onClick={() => navigate(`/messages/${conversation.id}`)}
                        aria-current={conversation.id === id}
                        className={cn(
                          'w-full px-4 py-3 text-left transition-colors',
                          conversation.id === id ? 'bg-primary-subtle' : 'hover:bg-accent/50',
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">{conversation.subject}</p>
                          {conversation.unreadCount > 0 && (
                            <Badge tone="primary">{conversation.unreadCount}</Badge>
                          )}
                        </div>
                        {conversation.studentName && (
                          <p className="truncate text-xs text-primary">
                            About {conversation.studentName}
                          </p>
                        )}
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation.lastMessagePreview}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelative(conversation.lastMessageAt)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}

        {showThread && (
          <Card className="flex max-h-[70vh] flex-col overflow-hidden">
            {!id ? (
              <EmptyState
                icon={<MessageSquare />}
                title="Choose a conversation"
                description="Or start a new one with a teacher or a parent."
              />
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border p-3">
                  {!isDesktop && (
                    <Button data-cy="messaging-messages-back" variant="ghost" size="sm" onClick={() => navigate('/messages')}>
                      Back
                    </Button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{active?.subject ?? 'Conversation'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {active?.participants.map((participant) => participant.name).join(', ')}
                      {active?.studentName ? ` · about ${active.studentName}` : ''}
                    </p>
                  </div>
                </div>

                <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.isPending ? (
                    <LoadingState label="Loading messages…" />
                  ) : (
                    messages.data?.map((message) => {
                      const mine = message.senderId === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}
                        >
                          {!mine && (
                            <Avatar
                              name={message.senderName}
                              src={message.senderPhotoUrl}
                              size="xs"
                              className="mt-1"
                            />
                          )}
                          <div
                            className={cn(
                              'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                              mine
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground',
                            )}
                          >
                            {!mine && (
                              <p className="mb-0.5 text-xs font-medium opacity-80">
                                {message.senderName}
                                <span className="font-normal"> · {message.senderRole}</span>
                              </p>
                            )}
                            <p className="whitespace-pre-line">{message.body}</p>
                            <p
                              className={cn(
                                'mt-1 text-[11px]',
                                mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                              )}
                            >
                              {formatDateTime(message.sentAt)}
                              {message.pending && ' · sending…'}
                              {message.failed && ' · failed to send'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <form
                  className="flex items-end gap-2 border-t border-border p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                >
                  <label htmlFor="message-draft" className="sr-only">
                    Your message
                  </label>
                  <Textarea
                    data-cy="message-draft"
                    id="message-draft"
                    rows={2}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
                    className="min-h-0 resize-none"
                  />
                  <Button
                    data-cy="messaging-messages-send-message"
                    type="submit"
                    size="icon"
                    aria-label="Send message"
                    loading={sendMessage.isPending}
                    disabled={!draft.trim()}
                  >
                    <Send />
                  </Button>
                </form>
              </>
            )}
          </Card>
        )}
      </div>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </PageContainer>
  );
}

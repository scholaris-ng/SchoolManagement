import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMessageContacts,
  useStartConversation,
} from './api';
import { Avatar, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/ui/feedback';

/**
 * Pieces used by `messages-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function ComposeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const start = useStartConversation();
  const contacts = useMessageContacts();

  const [subject, setSubject] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [body, setBody] = useState('');

  const valid = subject.trim() && recipientId && body.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            You can only message people connected to your children or your classes.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">To</legend>
            {contacts.isPending ? (
              <LoadingState label="Loading contacts…" />
            ) : (contacts.data?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                title="No one to message yet"
                description="Your school controls who can start a conversation with whom."
              />
            ) : (
              <div className="scrollbar-thin max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                {contacts.data?.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-accent"
                  >
                    <input
                      data-cy="messaging-messages-id"
                      type="radio"
                      name="recipient"
                      checked={recipientId === contact.id}
                      onChange={() => setRecipientId(contact.id)}
                      className="size-4 shrink-0"
                    />
                    <Avatar name={contact.name} src={contact.photoUrl} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{contact.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {contact.role}
                        {contact.subjects?.length ? ` · ${contact.subjects.join(', ')}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="compose-subject" required>
              Subject
            </Label>
            <Input
              data-cy="compose-subject"
              id="compose-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What is this about?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-body" required>
              Message
            </Label>
            <Textarea
              data-cy="compose-body"
              id="compose-body"
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="messaging-messages-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="messaging-messages-send"
            loading={start.isPending}
            disabled={!valid}
            onClick={() =>
              void start
                .mutateAsync({
                  subject: subject.trim(),
                  recipientIds: [recipientId],
                  body: body.trim(),
                })
                .then((conversation) => {
                  onOpenChange(false);
                  setSubject('');
                  setBody('');
                  setRecipientId('');
                  navigate(`/messages/${conversation.id}`);
                })
            }
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

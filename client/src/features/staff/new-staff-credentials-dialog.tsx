import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';

export interface NewStaffCredentials {
  fullName: string;
  email: string;
  temporaryPassword: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused by the browser; the value is still
      // shown on screen, so the admin can select and copy it by hand.
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <code className="flex-1 select-all break-all font-mono text-sm">{value}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Shown exactly once, right after a staff member is created.
 *
 * The account and its password exist the moment this dialog appears — the
 * server never stores the password and cannot show it again, so this is the
 * only chance anyone has to hand it to the new employee.
 */
export function NewStaffCredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: NewStaffCredentials | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={credentials !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            Sign-in created for {credentials?.fullName}
          </DialogTitle>
          <DialogDescription>
            A temporary password was generated. It is shown only this once — copy it now and pass
            it to them securely.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <CopyField label="Work email" value={credentials?.email ?? ''} />
          <CopyField label="Temporary password" value={credentials?.temporaryPassword ?? ''} />
          <Alert tone="warning" title="This will not be shown again">
            Ask them to sign in and change this password as soon as possible.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            I've saved this — continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

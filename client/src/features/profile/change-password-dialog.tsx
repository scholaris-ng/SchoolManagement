import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { toast } from '@/lib/toast-bus';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { PasswordField } from '@/components/forms/form-field';

/*
  The same rule the sign-up form applies, and the same reasoning: length does
  more for strength than character classes, so the floor is generous and the
  only composition rule rejects a single character repeated.
*/
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'That password is too long')
      .refine((value) => new Set(value).size > 3, 'Please choose a less predictable password'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Those passwords do not match',
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password you have not used here before',
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const EMPTY: ChangePasswordValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * Changing your own password, without leaving the app for an emailed link.
 *
 * Someone hired last week signed in with a password an administrator generated
 * and emailed to them, and was told to change it straight away. A reset link is
 * the wrong instrument for that: it is the recovery path for a password you
 * cannot remember, not the routine one for a password you can.
 *
 * The identity provider verifies the current password and owns the credential —
 * nothing here ever sees or stores one, and no password reaches our server.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { changePassword } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  // Nothing typed here outlives the dialog: reopening it must not present the
  // last attempt's passwords still sitting in the boxes.
  useEffect(() => {
    if (open) return;
    form.reset(EMPTY);
    setError(null);
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      toast.success('Password changed', {
        description: 'Use your new password the next time you sign in.',
      });
      onOpenChange(false);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Could not change your password. Please try again.';
      // A wrong current password belongs on that box, not in a banner the
      // reader has to map back onto one of three inputs themselves.
      if (message.toLowerCase().includes('current password')) {
        form.setError('currentPassword', { message });
        return;
      }
      setError(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" data-cy="change-password-dialog">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>
              You will stay signed in on this device. Other devices keep their sessions until they
              sign out.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {error && (
              <Alert tone="danger" data-cy="change-password-error">
                {error}
              </Alert>
            )}

            <PasswordField
              control={form.control}
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
              required
              leadingIcon={<Lock />}
            />
            <PasswordField
              control={form.control}
              name="newPassword"
              label="New password"
              autoComplete="new-password"
              required
              leadingIcon={<Lock />}
              description="At least 8 characters."
            />
            <PasswordField
              control={form.control}
              name="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
              required
              leadingIcon={<Lock />}
            />
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-cy="change-password-cancel"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-cy="change-password-submit"
              loading={form.formState.isSubmitting}
              loadingLabel="Changing…"
            >
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

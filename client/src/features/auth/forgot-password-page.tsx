import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/form-field';
import { Alert } from '@/components/ui/feedback';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
});

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await sendPasswordReset(values.email);
      // Always report success: confirming whether an address exists would let
      // anyone enumerate the school's parent and staff accounts.
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the reset email.');
    }
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link
          to="/sign-in"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>

        {sent ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-subtle text-success">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                If an account exists for {form.getValues('email')}, we have sent a link to reset
                the password. It expires in one hour.
              </p>
            </div>
            <Button data-cy="auth-forgot-password-return-to-sign-in" variant="outline" block asChild>
              <Link to="/sign-in">Return to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email address and we will send you a link to set a new password.
              </p>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <TextField
                control={form.control}
                name="email"
                label="Email address"
                type="email"
                autoComplete="email"
                required
                leadingIcon={<Mail />}
              />
              <Button data-cy="auth-forgot-password-send-reset-link" type="submit" block loading={form.formState.isSubmitting}>
                Send reset link
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

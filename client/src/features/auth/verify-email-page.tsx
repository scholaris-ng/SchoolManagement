import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { AuthEndpoints } from './auth.endpoints';
import { AuthLayout } from './auth-layout';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/form-field';
import { Alert } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api-error';

/**
 * Proving the address belongs to the person who registered (spec section 5).
 *
 * The account and the school already exist by the time anyone lands here, but
 * neither can be used until this succeeds — the API refuses a session for an
 * unverified address on every request, not only at sign-in.
 */
const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the six-digit code from your email'),
});

type VerifyValues = z.infer<typeof verifySchema>;

/** Long enough to discourage hammering resend, short enough not to strand anyone. */
const RESEND_COOLDOWN_SECONDS = 30;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const state = (location.state ?? null) as
    | { email?: string; schoolName?: string; password?: string }
    | null;

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const email = useRef(state?.email ?? '').current;
  // Carried in memory only (never persisted) from sign-up or a sign-in
  // attempt that already proved it against Firebase — see those pages.
  const password = useRef(state?.password ?? '').current;

  const form = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Arriving here directly, with no email to verify, is a dead end — send them
  // back rather than showing a form that cannot succeed.
  if (!email) {
    return (
      <AuthLayout>
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Nothing to verify</h2>
          <p className="text-sm text-muted-foreground">
            Start by creating your school, or sign in if you already have an account.
          </p>
          <div className="flex gap-2">
            <Button asChild block>
              <Link to="/sign-up">Create a school</Link>
            </Button>
            <Button asChild variant="outline" block>
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    try {
      await AuthEndpoints.verifyEmail(email, values.code);

      // With the password in hand, sign straight in rather than making a
      // person who just proved both their email and password type either
      // again. If that fails for any reason, fall back to sign-in the same
      // way an arrival without a password already does.
      if (password) {
        try {
          await signIn(email, password);
          navigate('/', { replace: true });
          return;
        } catch {
          // Fall through — the code was still valid, only the auto sign-in
          // didn't take.
        }
      }

      navigate('/sign-in', {
        replace: true,
        state: { verified: true, email },
      });
    } catch (cause) {
      setError(errorMessage(cause, 'That code could not be checked. Please try again.'));
    }
  });

  const resend = async () => {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await AuthEndpoints.resendVerification(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice(
        `If that address has an unverified account, a new code is on its way. It expires in ${result.expiresInMinutes} minutes.`,
      );
      // A resend invalidates the previous code, so clearing the box avoids
      // submitting one that has just stopped working.
      form.reset({ code: '' });
    } catch (cause) {
      setError(errorMessage(cause, 'Could not send a new code. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      headline="Almost there."
      blurb="Confirming your email keeps a school's records in the hands of the people who run it."
    >
      <div className="space-y-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary-subtle text-primary">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a six-digit code to <span className="font-medium text-foreground">{email}</span>
            {state?.schoolName ? ` to finish setting up ${state.schoolName}.` : '.'}
          </p>
        </div>
      </div>

      {error && (
        <Alert tone="danger" data-cy="verify-email-error">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="info" data-cy="verify-email-notice">
          {notice}
        </Alert>
      )}

      <form onSubmit={onSubmit} data-cy="verify-email-form" className="space-y-4" noValidate>
        {/* `TextField` passes only the props it declares, so the one-time-code
            hint that lets a phone offer the SMS/email code is all we set. */}
        <TextField
          control={form.control}
          name="code"
          label="Verification code"
          required
          autoComplete="one-time-code"
          placeholder="000000"
        />

        <Button
          data-cy="verify-email-submit"
          type="submit"
          block
          loading={form.formState.isSubmitting}
          loadingLabel="Checking…"
        >
          Verify email
        </Button>
      </form>

      <div className="space-y-2 text-center">
        <Button
          data-cy="verify-email-resend"
          type="button"
          variant="ghost"
          block
          disabled={cooldown > 0 || resending}
          onClick={() => void resend()}
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Codes expire after a few minutes. A new one replaces the old.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link to="/sign-in" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

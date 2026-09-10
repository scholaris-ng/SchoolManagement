import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Lock, Mail } from 'lucide-react';
import { env } from '@/lib/env';
import { isApiError } from '@/lib/api-error';
import { isMockIdentity } from '@/lib/identity';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/form-field';
import { Alert } from '@/components/ui/feedback';
import { FullPageLoader } from '@/components/layout/full-page-loader';
import { DemoBanner } from '@/components/layout/demo-banner';

/**
 * Sign-in shortcuts for the seeded personas.
 *
 * Both operands are build-time constants, so an ordinary production build drops
 * the chunk entirely and the persona list never reaches a published bundle. A
 * demo build keeps it, because clicking a role is the whole point of one.
 */
const PERSONAS_COMPILED_IN =
  import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

const DevPersonaPanel = PERSONAS_COMPILED_IN
  ? lazy(() => import('./dev-personas').then((m) => ({ default: m.DevPersonaPanel })))
  : null;

const signInSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  // Set by the verification page on its way here, so somebody who has just
  // finished registering is told it worked rather than facing a bare form.
  const arrivedVerified = (location.state as { verified?: boolean } | null)?.verified === true;

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'loading') return <FullPageLoader label="Checking your session…" />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/'} replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/', { replace: true });
    } catch (cause) {
      // The credentials were right but the address was never confirmed. Send
      // them to finish that rather than showing an error they cannot act on.
      if (isApiError(cause) && cause.isForbidden && /verify your email/i.test(cause.message)) {
        navigate('/verify-email', { state: { email: values.email } });
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.');
    }
  });

  const signInAs = async (email: string) => {
    setError(null);
    try {
      await signIn(email, 'demo');
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.');
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="lg:col-span-2">
        <DemoBanner />
      </div>
      {/* Brand panel — hidden on small screens where it would only push the
          form below the fold. */}
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Scholaris</span>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            One system for the whole school.
          </h1>
          <p className="text-primary-foreground/80">
            Admissions, attendance, curriculum coverage, results, fees and parent communication —
            built for how schools actually run, and for the days the internet does not.
          </p>
        </div>

        <p className="text-xs text-primary-foreground/60">
          Children's data is handled with privacy-first defaults. Photographs are never published
          without recorded consent.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use the email address your school registered for you.
            </p>
          </div>

          {arrivedVerified && !error && (
            <Alert tone="success" data-cy="sign-in-verified">
              Your email is confirmed. Sign in to open your school.
            </Alert>
          )}

          {error && (
            <Alert tone="danger" data-cy="sign-in-error">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} data-cy="sign-in-form" className="space-y-4" noValidate>
            <TextField
              control={form.control}
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              required
              placeholder="you@school.edu.ng"
              leadingIcon={<Mail />}
            />
            <TextField
              control={form.control}
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              leadingIcon={<Lock />}
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                data-cy="sign-in-forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            <Button
              data-cy="sign-in-submit"
              type="submit"
              block
              loading={form.formState.isSubmitting}
              loadingLabel="Signing in…"
            >
              Sign in
            </Button>
          </form>

          {DevPersonaPanel && (env.isDevelopment || env.isDemo) && isMockIdentity && (
            <Suspense fallback={null}>
              <DevPersonaPanel onSignInAs={(email) => void signInAs(email)} />
            </Suspense>
          )}

          <p className="text-center text-sm text-muted-foreground">
            New school?{' '}
            <Link to="/sign-up" data-cy="sign-in-sign-up" className="text-primary hover:underline">
              Create an account
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            Staff and parents are invited by their school. Trouble signing in? Contact your school
            administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { AuthEndpoints } from './auth.endpoints';
import { AuthLayout } from './auth-layout';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/form-field';
import { Alert } from '@/components/ui/feedback';
import { FullPageLoader } from '@/components/layout/full-page-loader';
import { errorMessage, isApiError } from '@/lib/api-error';

/**
 * School self-registration (spec section 6).
 *
 * One form creates the administrator's account and their school. Nothing is
 * usable until the emailed code is entered, so this hands straight off to
 * `/verify-email` rather than signing anyone in.
 */
const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name').max(100),
    lastName: z.string().trim().min(1, 'Enter your last name').max(100),
    schoolName: z.string().trim().min(2, 'Enter your school name').max(200),
    email: z
      .string()
      .trim()
      .min(1, 'Enter your email address')
      .email('Enter a valid email address'),
    // Matches the server's rule in registration.schema.ts. Length does more for
    // strength than character classes, so the floor is generous and the only
    // composition rule rejects a single repeated character.
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'That password is too long')
      .refine((value) => new Set(value).size > 3, 'Please choose a less predictable password'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Those passwords do not match',
  });

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      schoolName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (status === 'loading') return <FullPageLoader label="Checking your session…" />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await AuthEndpoints.register({
        firstName: values.firstName,
        lastName: values.lastName,
        schoolName: values.schoolName,
        email: values.email,
        password: values.password,
      });

      // The account exists but cannot be used yet, so the next step is the
      // code — not a dashboard the server would refuse anyway. The password
      // rides along in router state (memory only, never persisted) so that
      // once the code is confirmed, verification can sign the user straight
      // in instead of making them retype it.
      navigate('/verify-email', {
        replace: true,
        state: { email: result.email, schoolName: result.schoolName, password: values.password },
      });
    } catch (cause) {
      // Field-level messages from the server land on the right inputs.
      if (isApiError(cause) && cause.isValidation) {
        const fields = cause.fieldErrors();
        for (const [name, message] of Object.entries(fields)) {
          if (name in form.getValues()) {
            form.setError(name as keyof SignUpValues, { message });
          }
        }
      }
      setError(errorMessage(cause, 'Could not create your school. Please try again.'));
    }
  });

  return (
    <AuthLayout
      headline="Bring your school online."
      blurb="Set up in a minute. Add your classes and pupils when you are ready — nothing is locked until you decide to subscribe."
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Create your school</h2>
        <p className="text-sm text-muted-foreground">
          You will be the administrator. Staff and parents are invited afterwards.
        </p>
      </div>

      {error && (
        <Alert tone="danger" data-cy="sign-up-error">
          {error}
        </Alert>
      )}

      <form onSubmit={onSubmit} data-cy="sign-up-form" className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="firstName"
            label="First name"
            autoComplete="given-name"
            required
            leadingIcon={<User />}
          />
          <TextField
            control={form.control}
            name="lastName"
            label="Surname"
            autoComplete="family-name"
            required
          />
        </div>

        <TextField
          control={form.control}
          name="schoolName"
          label="School name"
          required
          placeholder="Brightfield Academy"
          leadingIcon={<Building2 />}
        />

        <TextField
          control={form.control}
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          placeholder="you@school.edu.ng"
          leadingIcon={<Mail />}
          description="We will send a six-digit code here to confirm it is yours."
        />

        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          leadingIcon={<Lock />}
          description="At least 8 characters."
        />

        <TextField
          control={form.control}
          name="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          leadingIcon={<Lock />}
        />

        <Button
          data-cy="sign-up-submit"
          type="submit"
          block
          loading={form.formState.isSubmitting}
          loadingLabel="Creating your school…"
        >
          Create school
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/sign-in" data-cy="sign-up-sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Staff and parents do not register here — your school invites them.
      </p>
    </AuthLayout>
  );
}

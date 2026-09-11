import { http } from '@/lib/http';

/**
 * Registration and email verification.
 *
 * These are the only endpoints the app calls without a session, and the only
 * ones that carry a password. The password goes to our API rather than to
 * Firebase from the browser: the server creates the credential with the Admin
 * SDK inside the same operation that provisions the school, so a failure
 * halfway through cannot leave a Firebase account with no school attached to
 * it (see `server/src/modules/auth/services/registration.service.ts`).
 */

export interface RegisterSchoolInput {
  firstName: string;
  lastName: string;
  schoolName: string;
  email: string;
  password: string;
}

export interface RegistrationResult {
  email: string;
  schoolName: string;
  /** Minutes the emailed code stays valid, so the UI can say so. */
  expiresInMinutes: number;
  emailVerified: boolean;
}

export interface VerificationResult {
  email: string;
  emailVerified: boolean;
}

export const AuthEndpoints = {
  register: (values: RegisterSchoolInput) =>
    http.post<RegistrationResult>('/auth/register', values),

  verifyEmail: (email: string, code: string) =>
    http.post<VerificationResult>('/auth/verify-email', { email, code }),

  /**
   * Answers the same way whether or not the address has an account, so this
   * cannot be used to discover which emails are registered.
   */
  resendVerification: (email: string) =>
    http.post<{ expiresInMinutes: number }>('/auth/resend-verification', { email }),

  /**
   * Emails a link for setting a new password.
   *
   * Goes through our API rather than straight to Firebase from the browser, so
   * the message arrives in the Scholaris template like every other mail the
   * school sends instead of unbranded from a service the recipient has never
   * heard of. Answers the same way whether or not the address has an account.
   */
  forgotPassword: (email: string) =>
    http.post<{ expiresInHours: number }>('/auth/forgot-password', { email }),
};

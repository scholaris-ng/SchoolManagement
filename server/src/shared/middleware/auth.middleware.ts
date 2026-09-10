import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '../../config/env';
import { getFirebaseAuth, isFirebaseConfigured } from '../../infrastructure/firebase/firebaseAdmin';
import { UserRepository } from '../../modules/auth/repositories/user.repository';
import type { AuthIdentity } from '../types/context';

/**
 * Verifies the bearer token and answers "who is this?" — nothing more
 * (spec section 5). What they may do is decided further down the chain, from
 * PostgreSQL, by `tenantMiddleware` and `authorise`.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw AppError.unauthenticated();

    req.identity = await resolveIdentity(token);
    next();
  } catch (error) {
    next(error);
  }
}

async function resolveIdentity(token: string): Promise<AuthIdentity> {
  if (env.devAuthEnabled && token.startsWith('mock-token:')) {
    return devIdentity(token);
  }

  if (!isFirebaseConfigured()) {
    // Distinguished from a bad token on purpose: this is the server being
    // misconfigured, not the caller being unauthenticated, and a 401 here would
    // send the client into a pointless sign-in loop.
    throw AppError.internal('Authentication is not configured on this server.');
  }

  let decoded;
  try {
    decoded = await getFirebaseAuth().verifyIdToken(token, true);
  } catch {
    throw AppError.unauthenticated('Your session has expired. Please sign in again.');
  }

  if (!decoded.email) {
    throw AppError.unauthenticated('This account has no email address.');
  }

  return {
    firebaseUid: decoded.uid,
    email: decoded.email.toLowerCase(),
    emailVerified: Boolean(decoded.email_verified),
    displayName: decoded.name ?? null,
    photoUrl: decoded.picture ?? null,
  };
}

/**
 * Development only, gated by `DEV_AUTH_ENABLED` and refused outright when
 * `NODE_ENV=production` (see `config/env.ts`).
 *
 * Accepts the `mock-token:<email>` form the client's mock identity provider
 * already sends, so the finished UI can be pointed at the real API and a real
 * database without a Firebase project existing yet. The email must match a user
 * that already exists — this creates nobody.
 */
async function devIdentity(token: string): Promise<AuthIdentity> {
  const email = token.slice('mock-token:'.length).trim().toLowerCase();
  if (!email) throw AppError.unauthenticated();

  const user = await UserRepository.Instance.findByEmail(email);
  if (!user) throw AppError.unauthenticated('No such development user.');

  return {
    firebaseUid: user.firebaseUid,
    email: user.email,
    emailVerified: true,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
  };
}

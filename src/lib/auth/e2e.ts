import type { Session } from 'next-auth';
import type { UserRole } from '@/types';
import { resolveRoleFromEmail } from './roles';

export const E2E_AUTH_COOKIE = 'e2e-session';

export type EffectiveSession = Session & {
  user: NonNullable<Session['user']> & {
    role: UserRole;
  };
};

export function isE2EAuthEnabled() {
  // Gate purely on the explicit, runtime-read E2E_AUTH_ENABLED flag (off by
  // default; a real production deployment must never set it). NODE_ENV is NOT a
  // usable guard here: Next freezes process.env.NODE_ENV as 'production' at build
  // time for the optimized standalone image — in every access form, dot or
  // bracket — so a NODE_ENV check disabled E2E auth even when the same image runs
  // locally/in CI with NODE_ENV=development. This matches the credentials-provider
  // gate in auth/config.ts, which already keys solely on E2E_AUTH_ENABLED.
  return process.env.E2E_AUTH_ENABLED === '1';
}

export function createE2ESession(email: string, name = 'E2E Admin'): EffectiveSession {
  const configuredAdminEmail = (
    process.env.E2E_ADMIN_EMAIL ||
    process.env.ADMIN_EMAILS?.split(/[,\n]/)[0]
  )?.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const role: UserRole = configuredAdminEmail && configuredAdminEmail === normalizedEmail
    ? 'ADMIN'
    : resolveRoleFromEmail(normalizedEmail);

  return {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: {
      email: normalizedEmail,
      name,
      role,
    },
  };
}

export function readE2EEmailFromCookieString(cookieValue: string) {
  return cookieValue.trim().toLowerCase();
}

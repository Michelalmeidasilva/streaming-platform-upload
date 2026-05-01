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
  return process.env.E2E_AUTH_ENABLED === '1' || process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED === '1';
}

export function createE2ESession(email: string, name = 'E2E Admin'): EffectiveSession {
  const configuredAdminEmail = (
    process.env.NEXT_PUBLIC_E2E_ADMIN_EMAIL ||
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

import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from './config';
import { createE2ESession, E2E_AUTH_COOKIE, isE2EAuthEnabled } from './e2e';
import { resolveRoleFromEmail } from './roles';
import type { UserRole } from '@/types';

export type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']> & {
    role: UserRole;
  };
};

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  if (isE2EAuthEnabled()) {
    const cookieStore = await cookies();
    const e2eEmail = cookieStore.get(E2E_AUTH_COOKIE)?.value;
    if (e2eEmail) {
      return createE2ESession(e2eEmail) as AuthenticatedSession;
    }
  }

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      role: resolveRoleFromEmail(session.user.email),
    },
  } as AuthenticatedSession;
}

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from './config';
import { resolveRoleFromEmail } from './roles';
import type { UserRole } from '@/types';

export type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']> & {
    role: UserRole;
  };
};

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
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

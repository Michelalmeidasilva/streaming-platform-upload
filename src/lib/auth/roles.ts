import type { UserRole } from '@/types';

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(/[,\n]/)
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function resolveRoleFromEmail(email?: string | null): UserRole {
  if (!email) {
    return 'MEMBER';
  }

  return getAdminEmails().has(email.toLowerCase()) ? 'ADMIN' : 'MEMBER';
}


import type { UserRole } from '@/types';

export type AuditEventType = 'access_denied' | 'rate_limited' | 'auth_success' | 'auth_failure';

export interface AuditEvent {
  type: AuditEventType;
  route: string;
  method: string;
  reason: string;
  status: number;
  ip?: string | null;
  userId?: string | null;
  email?: string | null;
  role?: UserRole | null;
}

export function recordSecurityEvent(event: AuditEvent) {
  const payload = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  console.info(JSON.stringify(payload));
}


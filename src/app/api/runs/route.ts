import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withEmf } from '@/lib/telemetry/emf';

export const dynamic = 'force-dynamic';

function ingestBaseUrl(): string {
  const raw =
    process.env.INGEST_PERSISTENCE_BASE_URL ||
    process.env.EVENT_GATEWAY_URL ||
    'http://localhost:8080/api/v1';
  return raw.replace(/\/$/, '');
}

async function getHandler(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    recordSecurityEvent({
      type: 'access_denied',
      route: '/api/runs',
      method: 'GET',
      reason: 'missing_session',
      status: 401,
      email: null,
      role: null,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canSearchVideos(session.user.role)) {
    recordSecurityEvent({
      type: 'access_denied',
      route: '/api/runs',
      method: 'GET',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const qs = new URLSearchParams();
  const machineLabel = searchParams.get('machineLabel');
  const codec = searchParams.get('codec');
  if (machineLabel) qs.set('machineLabel', machineLabel);
  if (codec) qs.set('codec', codec);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  try {
    const resp = await fetch(`${ingestBaseUrl()}/runs${suffix}`, { cache: 'no-store' });
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to load runs' }, { status: 502 });
    }
    const body = await resp.json();
    return NextResponse.json({ runs: body.runs ?? [] });
  } catch {
    return NextResponse.json({ error: 'Failed to load runs' }, { status: 502 });
  }
}

export const GET = withEmf('/api/runs', getHandler);

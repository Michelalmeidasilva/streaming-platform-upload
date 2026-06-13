import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withEmf } from '@/lib/telemetry/emf';

export const dynamic = 'force-dynamic';

function storebenchBaseUrl(): string {
  const raw = process.env.STOREBENCHSTORE_API_URL || 'http://localhost:8091';
  return raw.replace(/\/$/, '');
}

async function getHandler(_request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    recordSecurityEvent({
      type: 'access_denied',
      route: '/api/storebench-runs',
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
      route: '/api/storebench-runs',
      method: 'GET',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const base = storebenchBaseUrl();

  try {
    const [httpResp, benchResp] = await Promise.all([
      fetch(`${base}/http-runs`, { cache: 'no-store' }),
      fetch(`${base}/bench-runs`, { cache: 'no-store' }),
    ]);

    if (!httpResp.ok || !benchResp.ok) {
      return NextResponse.json({ error: 'Failed to load storebench data' }, { status: 502 });
    }

    const [httpBody, benchBody] = await Promise.all([httpResp.json(), benchResp.json()]);

    return NextResponse.json({
      httpRuns: httpBody.runs ?? [],
      benchRuns: benchBody.runs ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load storebench data' }, { status: 502 });
  }
}

export const GET = withEmf('/api/storebench-runs', getHandler);

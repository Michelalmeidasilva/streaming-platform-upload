import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withEmf } from '@/lib/telemetry/emf';

export const dynamic = 'force-dynamic';

function scalestoreBaseUrl(): string {
  const raw = process.env.SCALESTORE_API_URL || 'http://localhost:8090';
  return raw.replace(/\/$/, '');
}

async function getHandler(_request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    recordSecurityEvent({
      type: 'access_denied',
      route: '/api/distribution-runs',
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
      route: '/api/distribution-runs',
      method: 'GET',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const base = scalestoreBaseUrl();

  try {
    const [runsResp, projectionsResp] = await Promise.all([
      fetch(`${base}/runs`, { cache: 'no-store' }),
      fetch(`${base}/projections`, { cache: 'no-store' }),
    ]);

    if (!runsResp.ok || !projectionsResp.ok) {
      return NextResponse.json({ error: 'Failed to load distribution data' }, { status: 502 });
    }

    const [runsBody, projectionsBody] = await Promise.all([
      runsResp.json(),
      projectionsResp.json(),
    ]);

    return NextResponse.json({
      runs: runsBody.runs ?? [],
      projections: projectionsBody.projections ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load distribution data' }, { status: 502 });
  }
}

export const GET = withEmf('/api/distribution-runs', getHandler);

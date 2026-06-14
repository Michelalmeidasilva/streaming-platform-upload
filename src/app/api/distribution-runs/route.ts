import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withEmf } from '@/lib/telemetry/emf';
import type { DistributionRun, EngineQoE, DistributionProjection } from '@/types';

export const dynamic = 'force-dynamic';

// Serverless-native: the distribution load-test results (scalestore schema) live
// in the same Neon (Postgres) as storebench. This route reads them directly — no
// scalestore-api Go service to host — returning { runs, projections } with the
// per-engine QoE summary nested on each run (computed with native percentiles).
function databaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.STOREBENCH_DATABASE_URL || null;
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

  const url = databaseUrl();
  if (!url) {
    return NextResponse.json({ error: 'distribution database not configured' }, { status: 502 });
  }

  try {
    const sql = neon(url);
    const [runRows, qoeRows, projectionRows] = (await Promise.all([
      sql`SELECT id, tier, n_viewers, protocol, machine, asset_id, started_at
          FROM runs ORDER BY id DESC`,
      // Per-run, per-engine QoE summary (native percentiles), matching scalestore's
      // QoESummaryByEngine — computed for all runs in one pass.
      sql`SELECT run_id, player_engine,
                 count(*)::int AS samples,
                 percentile_cont(0.5)  WITHIN GROUP (ORDER BY startup_ms) AS startup_p50,
                 percentile_cont(0.95) WITHIN GROUP (ORDER BY startup_ms) AS startup_p95,
                 avg(rebuffer_ratio)   AS rebuffer_avg,
                 avg(avg_bitrate_kbps) AS bitrate_avg
          FROM viewer_samples GROUP BY run_id, player_engine ORDER BY run_id, player_engine`,
      sql`SELECT basis, n_target, egress_gb_h, agg_rps, connections, cost_usd_month, saturation_tier
          FROM projections ORDER BY n_target, id DESC`,
    ])) as unknown as [
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ];

    const qoeByRun = new Map<number, EngineQoE[]>();
    for (const q of qoeRows) {
      const runId = Number(q.run_id);
      const list = qoeByRun.get(runId) ?? [];
      list.push({
        RunID: runId,
        PlayerEngine: String(q.player_engine) as EngineQoE['PlayerEngine'],
        Samples: Number(q.samples),
        StartupP50MS: Number(q.startup_p50),
        StartupP95MS: Number(q.startup_p95),
        RebufferRatioAvg: Number(q.rebuffer_avg),
        BitrateAvgKbps: Number(q.bitrate_avg),
      });
      qoeByRun.set(runId, list);
    }

    const runs: DistributionRun[] = runRows.map((r) => ({
      id: Number(r.id),
      tier: String(r.tier),
      n_viewers: Number(r.n_viewers),
      protocol: String(r.protocol),
      machine: String(r.machine ?? ''),
      asset_id: String(r.asset_id ?? ''),
      started_at: String(r.started_at ?? ''),
      qoe: qoeByRun.get(Number(r.id)) ?? [],
    }));

    const projections: DistributionProjection[] = projectionRows.map((p) => ({
      basis: String(p.basis),
      n_target: Number(p.n_target),
      egress_gb_h: Number(p.egress_gb_h),
      agg_rps: Number(p.agg_rps),
      connections: Number(p.connections),
      cost_usd_month: Number(p.cost_usd_month),
      saturation_tier: String(p.saturation_tier ?? ''),
    }));

    return NextResponse.json({ runs, projections });
  } catch {
    return NextResponse.json({ error: 'Failed to load distribution data' }, { status: 502 });
  }
}

export const GET = withEmf('/api/distribution-runs', getHandler);

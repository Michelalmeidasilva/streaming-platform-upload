import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withEmf } from '@/lib/telemetry/emf';
import type {
  StorebenchHttpRun,
  StorebenchHttpResult,
  StorebenchBenchRun,
  StorebenchBenchResult,
} from '@/types';

export const dynamic = 'force-dynamic';

// Serverless-native: the storebench results live in Neon (Postgres). This route
// reads them directly (no separate Go service to host) and returns the same
// shape the UI expects: { httpRuns, benchRuns } with results nested per run.
function databaseUrl(): string | null {
  return process.env.STOREBENCH_DATABASE_URL || process.env.DATABASE_URL || null;
}

function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
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

  const url = databaseUrl();
  if (!url) {
    return NextResponse.json({ error: 'storebench database not configured' }, { status: 502 });
  }

  try {
    const sql = neon(url);
    const [httpRunRows, httpResultRows, benchRunRows, benchResultRows] = (await Promise.all([
      sql`SELECT id, mode, vus, rate, maxvus, trials, duration, machine, started_at, notes
          FROM http_runs ORDER BY id DESC`,
      sql`SELECT run_id, n, config, req_s, p95_ms, dropped, payload_bytes, sha256
          FROM http_results ORDER BY id`,
      sql`SELECT id, machine, go_version, started_at, notes
          FROM bench_runs ORDER BY id DESC`,
      sql`SELECT run_id, suite, name, config, n, op, ns_per_op, bytes_per_op, allocs_per_op, iters
          FROM bench_results ORDER BY id`,
    ])) as unknown as [
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ];

    const httpResults: StorebenchHttpResult[] = httpResultRows.map((r) => ({
      run_id: Number(r.run_id),
      n: Number(r.n),
      config: String(r.config),
      req_s: Number(r.req_s),
      p95_ms: Number(r.p95_ms),
      dropped: Number(r.dropped),
      payload_bytes: Number(r.payload_bytes),
      sha256: String(r.sha256 ?? ''),
    }));
    const httpRuns: StorebenchHttpRun[] = httpRunRows.map((r) => ({
      id: Number(r.id),
      mode: String(r.mode),
      vus: Number(r.vus),
      rate: Number(r.rate),
      maxvus: Number(r.maxvus),
      trials: Number(r.trials),
      duration: String(r.duration ?? ''),
      machine: String(r.machine ?? ''),
      started_at: String(r.started_at ?? ''),
      notes: String(r.notes ?? ''),
      results: httpResults.filter((x) => x.run_id === Number(r.id)),
    }));

    const benchResults: StorebenchBenchResult[] = benchResultRows.map((r) => ({
      run_id: Number(r.run_id),
      suite: String(r.suite),
      name: String(r.name),
      config: r.config === null || r.config === undefined ? null : String(r.config),
      n: numOrNull(r.n),
      op: r.op === null || r.op === undefined ? null : String(r.op),
      ns_per_op: Number(r.ns_per_op),
      bytes_per_op: numOrNull(r.bytes_per_op),
      allocs_per_op: numOrNull(r.allocs_per_op),
      iters: Number(r.iters),
    }));
    const benchRuns: StorebenchBenchRun[] = benchRunRows.map((r) => ({
      id: Number(r.id),
      machine: String(r.machine ?? ''),
      go_version: String(r.go_version ?? ''),
      started_at: String(r.started_at ?? ''),
      notes: String(r.notes ?? ''),
      results: benchResults.filter((x) => x.run_id === Number(r.id)),
    }));

    return NextResponse.json({ httpRuns, benchRuns });
  } catch {
    return NextResponse.json({ error: 'Failed to load storebench data' }, { status: 502 });
  }
}

export const GET = withEmf('/api/storebench-runs', getHandler);

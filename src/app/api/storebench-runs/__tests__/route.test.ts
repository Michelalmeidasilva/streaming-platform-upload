import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession: jest.fn(),
}));
import { getCurrentSession } from '@/lib/auth/session';

jest.mock('@neondatabase/serverless', () => ({ neon: jest.fn() }));
import { neon } from '@neondatabase/serverless';

const mockSession = getCurrentSession as jest.Mock;
const mockNeon = neon as unknown as jest.Mock;

function req(url = 'http://localhost/api/storebench-runs') {
  return new NextRequest(url);
}

describe('GET /api/storebench-runs', () => {
  const origStorebench = process.env.STOREBENCH_DATABASE_URL;
  const origDatabase = process.env.DATABASE_URL;
  afterEach(() => {
    process.env.STOREBENCH_DATABASE_URL = origStorebench;
    process.env.DATABASE_URL = origDatabase;
    jest.clearAllMocks();
  });

  it('returns 401 without a session', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is insufficient', async () => {
    mockSession.mockResolvedValue({ user: { role: undefined, email: 'a@b.c' } });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('returns 502 when no database is configured', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    delete process.env.STOREBENCH_DATABASE_URL;
    delete process.env.DATABASE_URL;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('reads Neon and returns httpRuns/benchRuns, coercing bigints and null fields', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.STOREBENCH_DATABASE_URL = 'postgres://x';
    // 4 queries, in order: http_runs, http_results, bench_runs, bench_results.
    // Mix of fully-populated and null-ish rows to exercise every branch.
    const sql = jest.fn()
      .mockResolvedValueOnce([
        { id: 1, mode: 'vus', vus: 10, rate: 0, maxvus: 0, trials: 3, duration: '15s', machine: 'local-i7', started_at: '2026-06-10T00:00:00Z', notes: 'n' },
        { id: 2, mode: 'arrival', vus: 0, rate: 20, maxvus: 60, trials: 3, duration: null, machine: null, started_at: null, notes: null },
      ])
      .mockResolvedValueOnce([
        { run_id: 1, n: 1000, config: 'redis', req_s: 4091, p50_ms: 2.1, p95_ms: 4.38, p99_ms: 7.9, dropped: 0, payload_bytes: '126976', sha256: '' },
        { run_id: 2, n: 50000, config: 'mongo', req_s: 12, p50_ms: 0, p95_ms: 1114, p99_ms: 0, dropped: 0, payload_bytes: '6501171', sha256: null }, // legacy row: COALESCE -> 0
      ])
      .mockResolvedValueOnce([
        { id: 1, machine: 'local-i7', go_version: 'go1.x', started_at: '2026-06-10T00:00:00Z', notes: '' },
        { id: 2, machine: null, go_version: null, started_at: null, notes: null },
      ])
      .mockResolvedValueOnce([
        { run_id: 1, suite: 'stores', name: 'postgres_direct/N=15000', config: 'postgres_direct', n: 15000, op: null, ns_per_op: 14900000, bytes_per_op: null, allocs_per_op: null, iters: '0' },
        { run_id: 1, suite: 'same_payload', name: 'bytes/redis/N=1000', config: null, n: 1000, op: 'bytes', ns_per_op: 1700000, bytes_per_op: '65536', allocs_per_op: '12', iters: '0' },
      ]);
    mockNeon.mockReturnValue(sql);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.httpRuns).toHaveLength(2);
    const run1 = body.httpRuns.find((r: { id: number }) => r.id === 1);
    expect(run1.results).toHaveLength(1);
    expect(run1.results[0].config).toBe('redis');
    expect(run1.results[0].p50_ms).toBe(2.1);
    expect(run1.results[0].p99_ms).toBe(7.9);
    expect(run1.results[0].payload_bytes).toBe(126976); // bigint string -> number
    const run2 = body.httpRuns.find((r: { id: number }) => r.id === 2);
    expect(run2.duration).toBe(''); // null -> ''
    expect(run2.results[0].sha256).toBe(''); // null -> ''

    expect(body.benchRuns).toHaveLength(2);
    const b1 = body.benchRuns.find((r: { id: number }) => r.id === 1);
    expect(b1.results).toHaveLength(2);
    const stores = b1.results.find((x: { name: string }) => x.name === 'postgres_direct/N=15000');
    expect(stores.ns_per_op).toBe(14900000);
    expect(stores.op).toBeNull();
    expect(stores.bytes_per_op).toBeNull();
    const sp = b1.results.find((x: { name: string }) => x.name === 'bytes/redis/N=1000');
    expect(sp.config).toBeNull();
    expect(sp.op).toBe('bytes');
    expect(sp.bytes_per_op).toBe(65536); // bigint string -> number
  });

  it('falls back to DATABASE_URL when STOREBENCH_DATABASE_URL is unset', async () => {
    mockSession.mockResolvedValue({ user: { role: 'MEMBER', email: 'b@c.d' } });
    delete process.env.STOREBENCH_DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://fallback';
    const sql = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockNeon.mockReturnValue(sql);

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mockNeon).toHaveBeenCalledWith('postgres://fallback');
    const body = await res.json();
    expect(body.httpRuns).toEqual([]);
    expect(body.benchRuns).toEqual([]);
  });

  it('returns 502 when the query throws', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.STOREBENCH_DATABASE_URL = 'postgres://x';
    mockNeon.mockReturnValue(jest.fn().mockRejectedValue(new Error('db error')));
    const res = await GET(req());
    expect(res.status).toBe(502);
  });
});

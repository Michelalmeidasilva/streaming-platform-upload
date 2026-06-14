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

function req(url = 'http://localhost/api/distribution-runs') {
  return new NextRequest(url);
}

describe('GET /api/distribution-runs', () => {
  const origDatabase = process.env.DATABASE_URL;
  const origStorebench = process.env.STOREBENCH_DATABASE_URL;
  afterEach(() => {
    process.env.DATABASE_URL = origDatabase;
    process.env.STOREBENCH_DATABASE_URL = origStorebench;
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
    delete process.env.DATABASE_URL;
    delete process.env.STOREBENCH_DATABASE_URL;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('reads Neon and nests per-engine QoE on each run', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.DATABASE_URL = 'postgres://x';
    // 3 queries in order: runs, qoe, projections
    const sql = jest.fn()
      .mockResolvedValueOnce([
        { id: 2, tier: 'T2', n_viewers: 10000, protocol: 'hls', machine: 'ec2:c7i.4xlarge', asset_id: 'a', started_at: '2026-06-13T00:00:00Z' },
        { id: 1, tier: 'T1', n_viewers: 1000, protocol: 'dash', machine: null, asset_id: null, started_at: null },
      ])
      .mockResolvedValueOnce([
        { run_id: 2, player_engine: 'gpac', samples: 9000, startup_p50: 820, startup_p95: 1500, rebuffer_avg: 0.02, bitrate_avg: 2800 },
        { run_id: 2, player_engine: 'shaka', samples: 20, startup_p50: 760, startup_p95: 1100, rebuffer_avg: 0.01, bitrate_avg: 3000 },
      ])
      .mockResolvedValueOnce([
        { basis: 'T1=1k,T2=10k', n_target: 1000000, egress_gb_h: 1260, agg_rps: 5000, connections: 800, cost_usd_month: 4200, saturation_tier: 'lambda' },
      ]);
    mockNeon.mockReturnValue(sql);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.runs).toHaveLength(2);
    const t2 = body.runs.find((r: { id: number }) => r.id === 2);
    expect(t2.qoe).toHaveLength(2);
    expect(t2.qoe[0].PlayerEngine).toBe('gpac');
    expect(t2.qoe[0].StartupP50MS).toBe(820);
    const t1 = body.runs.find((r: { id: number }) => r.id === 1);
    expect(t1.qoe).toEqual([]); // no samples for this run
    expect(t1.machine).toBe(''); // null -> ''

    expect(body.projections).toHaveLength(1);
    expect(body.projections[0].cost_usd_month).toBe(4200);
  });

  it('falls back to STOREBENCH_DATABASE_URL and returns empty when no data', async () => {
    mockSession.mockResolvedValue({ user: { role: 'MEMBER', email: 'b@c.d' } });
    delete process.env.DATABASE_URL;
    process.env.STOREBENCH_DATABASE_URL = 'postgres://fallback';
    const sql = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockNeon.mockReturnValue(sql);

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mockNeon).toHaveBeenCalledWith('postgres://fallback');
    const body = await res.json();
    expect(body.runs).toEqual([]);
    expect(body.projections).toEqual([]);
  });

  it('returns 502 when the query throws', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.DATABASE_URL = 'postgres://x';
    mockNeon.mockReturnValue(jest.fn().mockRejectedValue(new Error('db error')));
    const res = await GET(req());
    expect(res.status).toBe(502);
  });
});

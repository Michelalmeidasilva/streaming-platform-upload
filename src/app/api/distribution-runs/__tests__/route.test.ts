import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession: jest.fn(),
}));
import { getCurrentSession } from '@/lib/auth/session';

const mockSession = getCurrentSession as jest.Mock;

function req(url = 'http://localhost/api/distribution-runs') {
  return new NextRequest(url);
}

describe('GET /api/distribution-runs', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.clearAllMocks(); });

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

  it('returns runs and projections on success', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.SCALESTORE_API_URL = 'http://scalestore:8090';
    const sampleRun = { id: 2, tier: 'T1', n_viewers: 2, protocol: 'hls', machine: 'local', asset_id: 'a', started_at: '2026-06-13T11:40:34-03:00', qoe: [] };
    const sampleProjection = { basis: 'T1=1', n_target: 1000000, egress_gb_h: 1260000, agg_rps: 100000, connections: 5000, cost_usd_month: 78347712, saturation_tier: 'lambda' };

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [sampleRun] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ projections: [sampleProjection] }) }) as unknown as typeof fetch;

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.projections).toHaveLength(1);
    expect(body.runs[0].tier).toBe('T1');
    expect(body.projections[0].basis).toBe('T1=1');
  });

  it('returns 502 when runs upstream returns !ok', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ projections: [] }) }) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('returns 502 when projections upstream returns !ok', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 500 }) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch throws', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('uses SCALESTORE_API_URL env and strips trailing slash', async () => {
    mockSession.mockResolvedValue({ user: { role: 'MEMBER', email: 'b@c.d' } });
    process.env.SCALESTORE_API_URL = 'http://scalestore:8090/';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ projections: [] }) }) as unknown as typeof fetch;

    const res = await GET(req());
    expect(res.status).toBe(200);
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u === 'http://scalestore:8090/runs')).toBe(true);
    expect(calls.some((u) => u === 'http://scalestore:8090/projections')).toBe(true);
  });
});

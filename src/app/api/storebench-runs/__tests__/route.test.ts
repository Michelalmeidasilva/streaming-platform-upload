import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession: jest.fn(),
}));
import { getCurrentSession } from '@/lib/auth/session';

const mockSession = getCurrentSession as jest.Mock;

function req(url = 'http://localhost/api/storebench-runs') {
  return new NextRequest(url);
}

describe('GET /api/storebench-runs', () => {
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

  it('returns httpRuns and benchRuns on success', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.STOREBENCHSTORE_API_URL = 'http://storebenchstore:8091';
    const httpRun = { id: 1, mode: 'vus', vus: 10, rate: 0, maxvus: 0, trials: 3, duration: '15s', machine: 'local', started_at: '2026-06-13T00:00:00Z', notes: '', results: [] };
    const benchRun = { id: 1, machine: 'local', go_version: 'go1.25.0', started_at: '2026-06-13T00:00:00Z', notes: '', results: [] };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [httpRun] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [benchRun] }) }) as unknown as typeof fetch;

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.httpRuns).toHaveLength(1);
    expect(body.benchRuns).toHaveLength(1);
    expect(body.httpRuns[0].mode).toBe('vus');
  });

  it('returns 502 when an upstream returns !ok', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) }) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch throws', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });
});

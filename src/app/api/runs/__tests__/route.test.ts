import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession: jest.fn(),
}));
import { getCurrentSession } from '@/lib/auth/session';

const mockSession = getCurrentSession as jest.Mock;

function req(url = 'http://localhost/api/runs') {
  return new NextRequest(url);
}

describe('GET /api/runs', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.clearAllMocks(); });

  it('returns 401 without a session', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('proxies to ingest and returns runs', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.INGEST_PERSISTENCE_BASE_URL = 'http://ingest:8080/api/v1';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [{ jobId: 'v1-1', machineLabel: 'c7g' }] }),
    }) as unknown as typeof fetch;

    const res = await GET(req('http://localhost/api/runs?machineLabel=c7g'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('machineLabel=c7g');
  });

  it('returns 403 when role is insufficient', async () => {
    mockSession.mockResolvedValue({ user: { role: undefined, email: 'a@b.c' } });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('returns 502 when ingest fails', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch throws', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it('forwards the benchmark param to ingest', async () => {
    mockSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'a@b.c' } });
    process.env.INGEST_PERSISTENCE_BASE_URL = 'http://ingest:8080/api/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ runs: [] }) }) as unknown as typeof fetch;
    await GET(req('http://localhost/api/runs?benchmark=true'));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('benchmark=true');
  });

  it('forwards codec query param', async () => {
    mockSession.mockResolvedValue({ user: { role: 'MEMBER', email: 'b@c.d' } });
    process.env.INGEST_PERSISTENCE_BASE_URL = 'http://ingest:8080/api/v1';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [] }),
    }) as unknown as typeof fetch;

    const res = await GET(req('http://localhost/api/runs?codec=h264'));
    expect(res.status).toBe(200);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('codec=h264');
  });
});

import { GET } from '@/app/api/metrics/route';
import { withMetrics, httpRequestsTotal, getMetrics } from '@/lib/metrics';

describe('metrics endpoint', () => {
  it('exposes prometheus text with the RED metric families', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
  });

  it('withMetrics records a request', async () => {
    const wrapped = withMetrics('/api/__test', async () => new Response('ok', { status: 200 }));
    const before = await httpRequestsTotal.get();
    await wrapped(new Request('http://localhost/api/__test', { method: 'GET' }), {} as never);
    const after = await httpRequestsTotal.get();
    const sum = (s: typeof after) => s.values.reduce((a, v) => a + v.value, 0);
    expect(sum(after)).toBeGreaterThan(sum(before));
  });

  it('getMetrics returns the same singleton on repeated calls', () => {
    const first = getMetrics();
    const second = getMetrics();
    expect(first).toBe(second);
  });
});

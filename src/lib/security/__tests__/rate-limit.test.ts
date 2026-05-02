import { evaluateRateLimit, resetRateLimits } from '../rate-limit';

describe('rate limiting', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows requests until the limit is exceeded', () => {
    const config = { limit: 2, windowMs: 1000 };

    expect(evaluateRateLimit('route:ip', config, 0).allowed).toBe(true);
    expect(evaluateRateLimit('route:ip', config, 1).allowed).toBe(true);

    const blocked = evaluateRateLimit('route:ip', config, 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets once the window elapses', () => {
    const config = { limit: 1, windowMs: 1000 };

    expect(evaluateRateLimit('route:ip', config, 0).allowed).toBe(true);
    expect(evaluateRateLimit('route:ip', config, 1001).allowed).toBe(true);
  });
});

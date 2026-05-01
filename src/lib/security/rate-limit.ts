type RateLimitState = {
  count: number;
  resetAt: number;
};

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

const buckets = new Map<string, RateLimitState>();

export function evaluateRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: config.limit,
      remaining: Math.max(config.limit - 1, 0),
      resetAt,
      retryAfter: 0,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= config.limit;
  const remaining = allowed ? config.limit - existing.count : 0;

  if (!allowed) {
    buckets.set(key, existing);
  }

  return {
    allowed,
    limit: config.limit,
    remaining,
    resetAt: existing.resetAt,
    retryAfter: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
  };
}

export function resetRateLimits() {
  buckets.clear();
}


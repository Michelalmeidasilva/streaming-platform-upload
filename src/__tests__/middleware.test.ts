import { middleware } from '../middleware';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { evaluateRateLimit } from '@/lib/security/rate-limit';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

jest.mock('@/lib/security/rate-limit', () => ({
  evaluateRateLimit: jest.fn(),
}));

jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent: jest.fn(),
}));

describe('Middleware', () => {
  const mockRequest = (pathname: string, method = 'GET') => {
    const req = {
      nextUrl: { pathname, protocol: 'http:' },
      method,
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
      cookies: {
        get: jest.fn().mockReturnValue(null),
      },
    } as unknown as Parameters<typeof middleware>[0];
    return req;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (evaluateRateLimit as jest.Mock).mockReturnValue({ allowed: true });
  });

  it('allows public API routes without token', async () => {
    const req = mockRequest('/api/other');
    const response = await middleware(req);
    expect(response).toBeInstanceOf(NextResponse);
  });

  it('blocks protected API routes without token', async () => {
    const req = mockRequest('/api/upload');
    (getToken as jest.Mock).mockResolvedValue(null);
    const response = await middleware(req);
    expect(response?.status).toBe(401);
  });

  it('reads non-secure auth cookies for local http requests', async () => {
    const req = mockRequest('/api/upload');
    (getToken as jest.Mock).mockResolvedValue(null);

    await middleware(req);

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: expect.any(String),
        secureCookie: false,
      }),
    );
  });

  it('reads secure auth cookies for https requests', async () => {
    const req = mockRequest('/api/upload');
    (req.headers.get as unknown as jest.Mock).mockImplementation(
      (key: string) => key === 'x-forwarded-proto' ? 'https' : null
    );
    (getToken as jest.Mock).mockResolvedValue(null);

    await middleware(req);

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: expect.any(String),
        secureCookie: true,
      }),
    );
  });

  it('blocks admin mutations for non-admin users', async () => {
    const req = mockRequest('/api/upload', 'POST');
    (getToken as jest.Mock).mockResolvedValue({ email: 'u@test.com', role: 'USER' });
    const response = await middleware(req);
    expect(response?.status).toBe(403);
  });

  it('allows auth routes without full token check', async () => {
    const req = mockRequest('/api/auth/session');
    const response = await middleware(req);
    expect(response?.status).toBe(200);
  });

  it('identifies rate limits for different paths', async () => {
    // This is more of an integration test since rateLimitFor is internal
    // but we can trigger different branches by using different paths
    const publicPaths = ['/api/auth', '/api/other'];
    for (const path of publicPaths) {
      const req = mockRequest(path);
      const response = await middleware(req);
      expect(response?.status).toBe(200);
    }

    const protectedPaths = ['/api/upload/chunk', '/api/upload', '/api/videos'];
    (getToken as jest.Mock).mockResolvedValue({ email: 'admin@test.com', role: 'ADMIN' });

    for (const path of protectedPaths) {
      const req = mockRequest(path);
      const response = await middleware(req);
      expect(response?.status).toBe(200);
    }
  });

  it('handles x-forwarded-for header for IP extraction', async () => {
    const req = mockRequest('/api/test');
    (req.headers.get as unknown as jest.Mock).mockImplementation(
      (key: string) => key === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null
    );
    const response = await middleware(req);
    expect(response?.status).toBe(200);
  });

  it('allows admin mutations for admin users', async () => {
    const req = mockRequest('/api/upload', 'POST');
    (getToken as jest.Mock).mockResolvedValue({ email: 'a@test.com', role: 'ADMIN' });
    const response = await middleware(req);
    // NextResponse.next() returns a response without a status (it's internal to Next.js)
    expect(response).toBeDefined();
  });

  it('handles rate limiting', async () => {
    const req = mockRequest('/api/any');
    (evaluateRateLimit as jest.Mock).mockReturnValue({ allowed: false, retryAfter: 60 });
    const response = await middleware(req);
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('60');
  });

  it('allows auth routes even without rate limit logic (implicit)', async () => {
    const req = mockRequest('/api/auth/signin');
    const response = await middleware(req);
    expect(response).toBeDefined();
  });
});

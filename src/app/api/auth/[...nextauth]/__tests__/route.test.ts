import { GET, POST } from '../route';
import NextAuth from 'next-auth';

jest.mock('next-auth', () => jest.fn().mockReturnValue(jest.fn().mockResolvedValue({})));

describe('NextAuth API Routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_TRUST_HOST;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('calls NextAuth handler for GET', async () => {
    const req = {} as Request;
    const ctx = {};
    await GET(req, ctx);
    expect(NextAuth).toHaveBeenCalled();
  });

  it('calls NextAuth handler for POST', async () => {
    const req = {} as Request;
    const ctx = {};
    await POST(req, ctx);
    expect(NextAuth).toHaveBeenCalled();
  });

  it('enables trusted host forwarding in development', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    await GET({} as Request, {});

    expect(process.env.AUTH_TRUST_HOST).toBe('true');
  });

  it('does not override trusted host forwarding outside development', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';

    await POST({} as Request, {});

    expect(process.env.AUTH_TRUST_HOST).toBeUndefined();
  });
});

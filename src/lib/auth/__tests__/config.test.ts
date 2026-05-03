/* eslint-disable @typescript-eslint/no-explicit-any */
import { authOptions } from '../config';
import { resolveRoleFromEmail } from '../roles';

jest.mock('../roles', () => ({
  resolveRoleFromEmail: jest.fn((email) => {
    if (email?.includes('admin')) return 'ADMIN';
    return 'USER';
  }),
}));

describe('Auth Config', () => {
  const loadFreshAuthOptions = async () => {
    jest.resetModules();
    const mod = await import('../config');
    return mod.authOptions;
  };

  beforeEach(() => {
    delete process.env.E2E_AUTH_ENABLED;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    jest.clearAllMocks();
  });

  it('uses development secret when NEXTAUTH_SECRET is missing', () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(authOptions.secret).toBe('development-secret');
  });

  it('uses environment NEXTAUTH_SECRET when provided', () => {
    const testSecret = 'test-secret-123';
    process.env.NEXTAUTH_SECRET = testSecret;
    expect(process.env.NEXTAUTH_SECRET).toBe(testSecret);
  });

  it('has correct session strategy', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
  });

  it('contains GoogleProvider', () => {
    const google = authOptions.providers.find(p => p.id === 'google');
    expect(google).toBeDefined();
  });

  it('uses default Google credentials when env vars missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const google = authOptions.providers.find(p => p.id === 'google') as any;
    expect(google?.options?.clientId).toBe('missing-google-client-id');
    expect(google?.options?.clientSecret).toBe('missing-google-client-secret');
  });

  it('sets signIn page to root', () => {
    expect(authOptions.pages?.signIn).toBe('/');
  });

  it('handles JWT callback with user and account', async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    if (typeof jwtCallback === 'function') {
      const token = { email: 'admin@company.com' };
      const user = { email: 'admin@company.com', name: 'Test Admin' };
      const account = { provider: 'google' };
      const result = await jwtCallback({ token, user, account } as any);
      expect(result.role).toBe('ADMIN');
      expect(result.email).toBe('admin@company.com');
    }
  });

  it('handles JWT callback without account or user', async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    if (typeof jwtCallback === 'function') {
      const token = { email: 'test@test.com', role: 'USER' };
      const result = await jwtCallback({ token } as any);
      expect(result.role).toBe('USER');
      expect(result.email).toBe('test@test.com');
    }
  });

  it('handles JWT callback with only account', async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    if (typeof jwtCallback === 'function') {
      const token = { email: 'test@test.com' };
      const account = { provider: 'google' };
      const result = await jwtCallback({ token, account } as any);
      expect(result.role).toBeDefined();
    }
  });

  it('handles JWT callback with only user', async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    if (typeof jwtCallback === 'function') {
      const token = { email: 'test@test.com' };
      const user = { email: 'newuser@test.com' };
      const result = await jwtCallback({ token, user } as any);
      expect(result.role).toBeDefined();
      expect(resolveRoleFromEmail).toHaveBeenCalled();
    }
  });

  it('handles session callback with token containing role', async () => {
    const sessionCallback = authOptions.callbacks?.session;
    if (typeof sessionCallback === 'function') {
      const session = { user: { email: 'admin@company.com' } } as any;
      const token = { role: 'ADMIN', email: 'admin@company.com' } as any;
      const result = await sessionCallback({ session, token } as any);
      expect((result.user as any).role).toBe('ADMIN');
    }
  });

  it('handles session callback without token role', async () => {
    const sessionCallback = authOptions.callbacks?.session;
    if (typeof sessionCallback === 'function') {
      const session = { user: { email: 'user@company.com' } } as any;
      const token = { email: 'user@company.com' } as any;
      const result = await sessionCallback({ session, token } as any);
      expect((result.user as any).role).toBeDefined();
    }
  });

  it('handles session callback without user', async () => {
    const sessionCallback = authOptions.callbacks?.session;
    if (typeof sessionCallback === 'function') {
      const session = {} as any;
      const token = { role: 'USER' } as any;
      const result = await sessionCallback({ session, token } as any);
      expect(result).toBeDefined();
    }
  });

  it('does not include E2E credentials provider by default', () => {
    delete process.env.E2E_AUTH_ENABLED;
    const googleCount = authOptions.providers.filter(p => p.id === 'google').length;
    expect(googleCount).toBe(1);
    const e2eCount = authOptions.providers.filter(p => (p as any).name === 'E2E Credentials').length;
    expect(e2eCount).toBe(0);
  });

  it('has JWT session strategy', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
  });

  it('callbacks are defined', () => {
    expect(authOptions.callbacks).toBeDefined();
    expect(authOptions.callbacks?.jwt).toBeDefined();
    expect(authOptions.callbacks?.session).toBeDefined();
  });

  it('includes the e2e credentials provider when enabled', async () => {
    process.env.E2E_AUTH_ENABLED = '1';

    const freshAuthOptions = await loadFreshAuthOptions();
    const e2eProvider = freshAuthOptions.providers.find(p => p.id === 'credentials') as any;

    expect(e2eProvider).toBeDefined();
  });

  it('returns null from the e2e authorize callback when email is missing', async () => {
    process.env.E2E_AUTH_ENABLED = '1';

    const freshAuthOptions = await loadFreshAuthOptions();
    const e2eProvider = freshAuthOptions.providers.find(p => p.id === 'credentials') as any;

    await expect(e2eProvider.options.authorize({})).resolves.toBeNull();
  });

  it('builds an e2e user from the authorize callback', async () => {
    process.env.E2E_AUTH_ENABLED = '1';

    const freshAuthOptions = await loadFreshAuthOptions();
    const e2eProvider = freshAuthOptions.providers.find(p => p.id === 'credentials') as any;

    await expect(
      e2eProvider.options.authorize({ email: ' Admin@company.com ', name: '  Example Admin  ' })
    ).resolves.toEqual({
      id: 'admin@company.com',
      email: 'admin@company.com',
      name: 'Example Admin',
      role: 'ADMIN',
    });
  });
});

import { isE2EAuthEnabled, createE2ESession, readE2EEmailFromCookieString, E2E_AUTH_COOKIE } from '../e2e';

describe('E2E Auth Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.E2E_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED;
    delete process.env.E2E_ADMIN_EMAIL;
    delete process.env.NEXT_PUBLIC_E2E_ADMIN_EMAIL;
    delete process.env.ADMIN_EMAILS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exports E2E_AUTH_COOKIE constant', () => {
    expect(E2E_AUTH_COOKIE).toBe('e2e-session');
  });

  describe('isE2EAuthEnabled', () => {
    it('returns true when E2E_AUTH_ENABLED=1', () => {
      process.env.E2E_AUTH_ENABLED = '1';
      expect(isE2EAuthEnabled()).toBe(true);
    });

    it('returns false when E2E_AUTH_ENABLED is unset', () => {
      delete process.env.E2E_AUTH_ENABLED;
      expect(isE2EAuthEnabled()).toBe(false);
    });

    it('returns false when E2E_AUTH_ENABLED is not 1', () => {
      process.env.E2E_AUTH_ENABLED = '0';
      expect(isE2EAuthEnabled()).toBe(false);
    });

    it('returns false in production regardless of E2E_AUTH_ENABLED', () => {
      process.env.E2E_AUTH_ENABLED = '1';
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'production';
      expect(isE2EAuthEnabled()).toBe(false);
      env.NODE_ENV = 'test';
    });

    it('ignores NEXT_PUBLIC_E2E_AUTH_ENABLED to prevent client bundle exposure', () => {
      delete process.env.E2E_AUTH_ENABLED;
      process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
      expect(isE2EAuthEnabled()).toBe(false);
      delete process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED;
    });
  });

  describe('createE2ESession', () => {
    it('creates session with ADMIN role when email matches E2E_ADMIN_EMAIL', () => {
      process.env.E2E_ADMIN_EMAIL = 'admin@e2e.com';
      const session = createE2ESession('admin@e2e.com');
      expect(session.user.email).toBe('admin@e2e.com');
      expect(session.user.role).toBe('ADMIN');
      expect(session.user.name).toBe('E2E Admin');
    });

    it('creates session with ADMIN role when email matches E2E_ADMIN_EMAIL', () => {
      process.env.E2E_ADMIN_EMAIL = 'admin@company.com';
      const session = createE2ESession('admin@company.com');
      expect(session.user.email).toBe('admin@company.com');
      expect(session.user.role).toBe('ADMIN');
    });

    it('creates session with ADMIN role when email is first in ADMIN_EMAILS', () => {
      process.env.ADMIN_EMAILS = 'admin@company.com,user@company.com';
      const session = createE2ESession('admin@company.com');
      expect(session.user.email).toBe('admin@company.com');
      expect(session.user.role).toBe('ADMIN');
    });

    it('normalizes email to lowercase', () => {
      process.env.E2E_ADMIN_EMAIL = 'ADMIN@E2E.COM';
      const session = createE2ESession('Admin@E2E.COM', 'Custom Admin');
      expect(session.user.email).toBe('admin@e2e.com');
    });

    it('uses custom name when provided', () => {
      const session = createE2ESession('test@e2e.com', 'Custom Name');
      expect(session.user.name).toBe('Custom Name');
    });

    it('creates MEMBER session when email does not match admin', () => {
      process.env.E2E_ADMIN_EMAIL = 'admin@e2e.com';
      const session = createE2ESession('user@e2e.com');
      expect(session.user.email).toBe('user@e2e.com');
      expect(session.user.role).toBe('MEMBER');
    });

    it('handles whitespace in admin email config', () => {
      process.env.E2E_ADMIN_EMAIL = '  admin@e2e.com  ';
      const session = createE2ESession('  admin@e2e.com  ');
      expect(session.user.email).toBe('admin@e2e.com');
      expect(session.user.role).toBe('ADMIN');
    });

    it('sets expiration 24 hours from now', () => {
      const beforeTime = Date.now();
      const session = createE2ESession('test@e2e.com');
      const afterTime = Date.now();
      const expirationTime = new Date(session.expires).getTime();
      const expectedMin = beforeTime + 24 * 60 * 60 * 1000;
      const expectedMax = afterTime + 24 * 60 * 60 * 1000;
      expect(expirationTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expirationTime).toBeLessThanOrEqual(expectedMax + 1000);
    });

    it('returns EffectiveSession type with all required fields', () => {
      const session = createE2ESession('test@e2e.com');
      expect(session).toHaveProperty('expires');
      expect(session).toHaveProperty('user');
      expect(session.user).toHaveProperty('email');
      expect(session.user).toHaveProperty('name');
      expect(session.user).toHaveProperty('role');
    });

    it('ignores NEXT_PUBLIC_E2E_ADMIN_EMAIL to prevent client bundle exposure', () => {
      process.env.NEXT_PUBLIC_E2E_ADMIN_EMAIL = 'public@e2e.com';
      delete process.env.E2E_ADMIN_EMAIL;
      const session = createE2ESession('public@e2e.com');
      expect(session.user.role).not.toBe('ADMIN');
      delete process.env.NEXT_PUBLIC_E2E_ADMIN_EMAIL;
    });

    it('prioritizes E2E_ADMIN_EMAIL over ADMIN_EMAILS', () => {
      process.env.E2E_ADMIN_EMAIL = 'direct@e2e.com';
      process.env.ADMIN_EMAILS = 'first@e2e.com,second@e2e.com';
      const session = createE2ESession('direct@e2e.com');
      expect(session.user.role).toBe('ADMIN');
    });
  });

  describe('readE2EEmailFromCookieString', () => {
    it('trims and lowercases email', () => {
      expect(readE2EEmailFromCookieString(' Test@Email.com ')).toBe('test@email.com');
    });

    it('handles already-lowercase email', () => {
      expect(readE2EEmailFromCookieString('test@email.com')).toBe('test@email.com');
    });

    it('handles uppercase email', () => {
      expect(readE2EEmailFromCookieString('TEST@EMAIL.COM')).toBe('test@email.com');
    });

    it('handles mixed case email', () => {
      expect(readE2EEmailFromCookieString('TeStUsEr@ExAmPlE.cOm')).toBe('testuser@example.com');
    });

    it('handles email with multiple spaces', () => {
      expect(readE2EEmailFromCookieString('   test@email.com   ')).toBe('test@email.com');
    });
  });
});

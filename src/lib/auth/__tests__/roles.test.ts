import { resolveRoleFromEmail } from '../roles';

describe('Auth Roles Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolves ADMIN role if email is in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com,boss@test.com';
    expect(resolveRoleFromEmail('admin@test.com')).toBe('ADMIN');
    expect(resolveRoleFromEmail('BOSS@test.com')).toBe('ADMIN');
  });

  it('resolves MEMBER role if email is not in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com';
    expect(resolveRoleFromEmail('user@test.com')).toBe('MEMBER');
  });

  it('resolves MEMBER role if email is missing', () => {
    expect(resolveRoleFromEmail(null)).toBe('MEMBER');
    expect(resolveRoleFromEmail(undefined)).toBe('MEMBER');
  });
});

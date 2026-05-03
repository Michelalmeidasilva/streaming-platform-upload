/* eslint-disable @typescript-eslint/no-require-imports */
import { getCurrentSession, requireSession } from '../session';
import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { isE2EAuthEnabled } from '../e2e';

jest.mock('next-auth/next');
jest.mock('next/headers');
jest.mock('../e2e');
jest.mock('../roles');

const { resolveRoleFromEmail } = require('../roles');

describe('Auth Session Utility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (resolveRoleFromEmail as jest.Mock).mockReturnValue('USER');
  });

  it('returns E2E session if enabled and cookie present', async () => {
    (isE2EAuthEnabled as jest.Mock).mockReturnValue(true);
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'e2e@test.com' }),
    });
    (require('../e2e').createE2ESession as jest.Mock).mockReturnValue({
      user: { email: 'e2e@test.com', role: 'ADMIN' }
    });

    const session = await getCurrentSession();
    expect(session?.user.email).toBe('e2e@test.com');
  });

  it('returns server session when authenticated', async () => {
    (isE2EAuthEnabled as jest.Mock).mockReturnValue(false);
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { email: 'user@test.com', name: 'User' },
    });

    const session = await getCurrentSession();
    expect(session?.user.email).toBe('user@test.com');
    expect(session?.user.role).toBe('USER');
  });

  it('returns null when not authenticated', async () => {
    (isE2EAuthEnabled as jest.Mock).mockReturnValue(false);
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const session = await getCurrentSession();
    expect(session).toBeNull();
  });

  it('throws in requireSession when not authenticated', async () => {
    (isE2EAuthEnabled as jest.Mock).mockReturnValue(false);
    (getServerSession as jest.Mock).mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow('Unauthorized');
  });
});

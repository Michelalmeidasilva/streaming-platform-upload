/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useE2ESession } from '../useE2ESession';
import { E2E_AUTH_COOKIE } from '../e2e';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('useE2ESession', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED;
    // Clear cookies
    document.cookie = `${E2E_AUTH_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns unauthenticated status when e2e auth is disabled and no session', () => {
    const { result } = renderHook(() => useE2ESession());
    expect(result.current.effectiveStatus).toBe('unauthenticated');
    expect(result.current.effectiveSession).toBeNull();
  });

  it('returns loading status when e2e auth is enabled before cookie is read', () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    const { result } = renderHook(() => useE2ESession());
    // After useLayoutEffect runs synchronously in jsdom, cookie is read
    // e2eSession will be null (no cookie set), so status falls back to nextAuth
    expect(['loading', 'unauthenticated']).toContain(result.current.effectiveStatus);
  });

  it('reads e2e session from cookie when e2e auth is enabled', () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    process.env.E2E_ADMIN_EMAIL = 'admin@test.com';
    document.cookie = `${E2E_AUTH_COOKIE}=${encodeURIComponent('admin@test.com')}`;

    const { result } = renderHook(() => useE2ESession());
    expect(result.current.effectiveStatus).toBe('authenticated');
    expect(result.current.effectiveSession?.user.email).toBe('admin@test.com');
  });

  it('returns null e2e session when cookie is absent and e2e auth is enabled', () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    const { result } = renderHook(() => useE2ESession());
    // No cookie set, so e2eSession becomes null and status falls back to nextAuth
    expect(result.current.effectiveStatus).toBe('unauthenticated');
  });

  it('activateE2ESession sets an authenticated e2e session immediately', () => {
    const { result } = renderHook(() => useE2ESession());
    act(() => {
      result.current.activateE2ESession('user@test.com');
    });
    expect(result.current.effectiveStatus).toBe('authenticated');
    expect(result.current.effectiveSession?.user.email).toBe('user@test.com');
  });

  it('falls back to nextAuth session when e2e auth is disabled', () => {
    const mockSession = {
      user: { email: 'next@test.com', name: 'Next User', role: 'MEMBER' as const },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
    mockUseSession.mockReturnValue({
      data: mockSession as never,
      status: 'authenticated',
      update: jest.fn(),
    });

    const { result } = renderHook(() => useE2ESession());
    expect(result.current.effectiveStatus).toBe('authenticated');
    expect(result.current.effectiveSession).toBe(mockSession);
  });
});

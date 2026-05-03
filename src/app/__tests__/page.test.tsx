/** @jest-environment jsdom */
/* eslint-disable react/display-name */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Home from '../page';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { createE2ESession } from '@/lib/auth/e2e';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: jest.fn(),
}));

jest.mock('@/lib/auth/e2e', () => ({
  createE2ESession: jest.fn(),
  E2E_AUTH_COOKIE: 'e2e-session',
}));

jest.mock('@/components/UploadArea', () => () => <div data-testid="upload-area" />);
jest.mock('@/components/VideoList', () => () => <div data-testid="video-list" />);
jest.mock('@/components/ThemeToggle', () => () => <div data-testid="theme-toggle" />);
jest.mock('@/components/LoadingSpinner', () => () => <div data-testid="loading-spinner" />);

describe('Home Page', () => {
  const mockRouter = { push: jest.fn() };
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_E2E_AUTH_ENABLED: '0' };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useI18n as jest.Mock).mockReturnValue({
      locale: 'en',
      t: (key: string) => key,
      setLocale: jest.fn(),
    });
    (createE2ESession as jest.Mock).mockImplementation((email: string) => ({
      user: { email, role: 'ADMIN', name: 'E2E Admin' },
    }));
    mockRouter.push.mockReset();
    document.cookie = '';
    document.head.innerHTML = '<meta name="description" content="old" />';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('renders loading state', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'loading', data: null });
    const { getByTestId } = render(<Home />);
    expect(getByTestId('loading-spinner')).toBeDefined();
  });

  it('renders home page when authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'test@test.com', role: 'ADMIN' } },
    });
    const { getByTestId } = render(<Home />);
    expect(getByTestId('upload-area')).toBeDefined();
    expect(getByTestId('video-list')).toBeDefined();
  });

  it('redirects to login when unauthenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });
    render(<Home />);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/login');
  });

  it('updates document metadata from translations', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'test@test.com', role: 'ADMIN' } },
    });

    render(<Home />);

    await waitFor(() => {
      expect(document.title).toBe('metadata.title');
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'metadata.description');
    });
  });

  it('changes locale from the selector', () => {
    const setLocale = jest.fn();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'test@test.com', role: 'ADMIN' } },
    });
    (useI18n as jest.Mock).mockReturnValue({
      locale: 'en',
      t: (key: string) => key,
      setLocale,
    });

    const { getByLabelText } = render(<Home />);

    fireEvent.change(getByLabelText('locale.label'), { target: { value: 'pt' } });

    expect(setLocale).toHaveBeenCalledWith('pt');
  });

  it('calls signIn for regular users when the sign-in button is clicked', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    const { getByText } = render(<Home />);

    fireEvent.click(getByText('auth.signInWithGoogle'));

    expect(signIn).toHaveBeenCalledWith('google');
  });

  it('calls signOut for regular authenticated users', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'test@test.com', role: 'ADMIN', name: 'Admin' } },
    });

    const { getByText } = render(<Home />);

    fireEvent.click(getByText('auth.signOut'));

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('supports the e2e admin sign-in flow', async () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    process.env.NEXT_PUBLIC_E2E_ADMIN_EMAIL = 'admin-e2e@example.com';
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    const { getByText } = render(<Home />);

    fireEvent.click(getByText('auth.signInAsE2EAdmin'));

    await waitFor(() => {
      expect(document.cookie).toContain('e2e-session=admin-e2e%40example.com');
      expect(createE2ESession).toHaveBeenCalledWith('admin-e2e@example.com');
    });
  });

  it('clears the e2e cookie when signing out from an e2e session', async () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    document.cookie = 'e2e-session=admin-e2e%40example.com';
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    const { getByText } = render(<Home />);

    await waitFor(() => {
      expect(getByText('auth.signOut')).toBeDefined();
    });

    fireEvent.click(getByText('auth.signOut'));

    expect(document.cookie).toBe('');
    expect(signOut).not.toHaveBeenCalled();
  });
});

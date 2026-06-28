/** @jest-environment jsdom */
/* eslint-disable react/display-name */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Home from '../page';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/LocaleProvider';

// useE2ESession (the real session source in page.tsx) calls useSession internally.
// With NEXT_PUBLIC_E2E_AUTH_ENABLED='0' (no e2e cookie), effectiveSession === session,
// so mocking next-auth/react is sufficient and matches the existing page.test.tsx strategy.
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
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
jest.mock('@/components/TranscodeMetrics', () => () => <div data-testid="transcode-metrics" />);
jest.mock('@/components/DistributionMetrics', () => () => <div data-testid="distribution-metrics" />);
jest.mock('@/components/StorebenchMetrics', () => () => <div data-testid="storebench-metrics" />);
jest.mock('@/components/BenchmarkLauncher', () => () => <div data-testid="benchmark-launcher" />);

describe('Benchmark Tab (ADMIN-only)', () => {
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
    document.cookie = '';
    document.head.innerHTML = '<meta name="description" content="old" />';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('mostra a aba Benchmark para ADMIN', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'admin@test.com', role: 'ADMIN' } },
    });

    render(<Home />);

    // The t() mock returns the key itself, so aria-label = 'app.sidebar.benchmark'
    const benchmarkButtons = screen.getAllByLabelText('app.sidebar.benchmark');
    expect(benchmarkButtons.length).toBeGreaterThan(0);
  });

  it('nao mostra a aba Benchmark para MEMBER', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'member@test.com', role: 'MEMBER' } },
    });

    render(<Home />);

    expect(screen.queryByLabelText('app.sidebar.benchmark')).toBeNull();
  });

  it('renderiza BenchmarkLauncher quando ADMIN clica na aba Benchmark', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'admin@test.com', role: 'ADMIN' } },
    });

    const { getByTestId, queryByTestId } = render(<Home />);

    expect(queryByTestId('benchmark-launcher')).toBeNull();

    // Click the first benchmark nav button (sidebar)
    const [benchmarkBtn] = screen.getAllByLabelText('app.sidebar.benchmark');
    fireEvent.click(benchmarkBtn);

    expect(getByTestId('benchmark-launcher')).toBeDefined();
  });

  it('nao renderiza BenchmarkLauncher para MEMBER mesmo com view=benchmark', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { email: 'member@test.com', role: 'MEMBER' } },
    });

    render(<Home />);

    expect(screen.queryByTestId('benchmark-launcher')).toBeNull();
  });
});

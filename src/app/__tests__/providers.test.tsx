/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render } from '@testing-library/react';
import Providers from '../providers';

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: any) => <div data-testid="session-provider">{children}</div>,
}));

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  LocaleProvider: ({ children }: any) => <div data-testid="locale-provider">{children}</div>,
}));

jest.mock('@/lib/theme/ThemeContext', () => ({
  ThemeProvider: ({ children }: any) => <div data-testid="theme-provider">{children}</div>,
}));

describe('Providers', () => {
  it('renders all context providers', () => {
    const { getByTestId } = render(
      <Providers initialLocale="en">
        <span>Content</span>
      </Providers>
    );
    expect(getByTestId('theme-provider')).toBeDefined();
    expect(getByTestId('session-provider')).toBeDefined();
    expect(getByTestId('locale-provider')).toBeDefined();
  });
});

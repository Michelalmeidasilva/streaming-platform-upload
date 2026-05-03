/** @jest-environment jsdom */
/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any */
import React from 'react';
import { render } from '@testing-library/react';
import RootLayout from '../layout';
import { cookies } from 'next/headers';
import { translate } from '@/lib/i18n/translations';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue({ value: 'en' }),
  }),
}));

jest.mock('../providers', () => ({ children }: any) => <div data-testid="providers">{children}</div>);

describe('RootLayout', () => {
  beforeEach(() => {
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'en' }),
    });
  });

  it('renders children within providers', () => {
    const { getByTestId, getByText } = render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>
    );
    expect(getByTestId('providers')).toBeDefined();
    expect(getByText('Content')).toBeDefined();
  });

  it('uses the locale from cookies on the html tag', () => {
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'pt-BR' }),
    });

    const { container } = render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>
    );

    expect(container.querySelector('html')).toHaveAttribute('lang', 'pt');
  });

  it('generates translated metadata using the normalized locale', async () => {
    const { generateMetadata } = await import('../layout');
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'es-MX' }),
    });

    await expect(generateMetadata()).resolves.toEqual({
      title: translate('es', 'metadata.title'),
      description: translate('es', 'metadata.description'),
    });
  });

  it('falls back to the default locale when the cookie is missing', async () => {
    const { generateMetadata } = await import('../layout');
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    });

    const { container } = render(
      <RootLayout>
        <span>Fallback</span>
      </RootLayout>
    );

    expect(container.querySelector('html')).toHaveAttribute('lang', 'en');
    await expect(generateMetadata()).resolves.toEqual({
      title: translate('en', 'metadata.title'),
      description: translate('en', 'metadata.description'),
    });
  });
});

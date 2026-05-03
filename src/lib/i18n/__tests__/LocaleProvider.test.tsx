/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { LocaleProvider, useI18n } from '../LocaleProvider';
import { DEFAULT_LOCALE } from '../translations';

describe('LocaleProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = '';
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LocaleProvider initialLocale={DEFAULT_LOCALE}>{children}</LocaleProvider>
  );

  it('provides the initial locale', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe(DEFAULT_LOCALE);
  });

  it('updates locale and persists to storage/cookies', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => {
      result.current.setLocale('pt');
    });

    expect(result.current.locale).toBe('pt');
    expect(localStorage.getItem('streaming-platform-upload:locale')).toBe('pt');
    expect(document.cookie).toContain('locale=pt');
  });

  it('translates keys', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // This depends on actual translations, but we can check if it returns a string
    expect(typeof result.current.t('metadata.title')).toBe('string');
  });

  it('formats dates', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const date = new Date('2023-01-01T12:00:00Z');
    const formatted = result.current.formatDate(date);
    expect(formatted).toBeDefined();
  });

  it('hydrates the locale from localStorage on mount', () => {
    localStorage.setItem('streaming-platform-upload:locale', 'es');

    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.locale).toBe('es');
  });

  it('normalizes unsupported locale values when updating', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => {
      result.current.setLocale('fr' as any);
    });

    expect(result.current.locale).toBe(DEFAULT_LOCALE);
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(() => renderHook(() => useI18n())).toThrow('useI18n must be used within a LocaleProvider');
    consoleSpy.mockRestore();
  });
});

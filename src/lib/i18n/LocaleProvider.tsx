'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  type Locale,
  getLocaleCode,
  normalizeLocale,
  translate,
} from './translations';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: React.ReactNode;
  initialLocale: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const storedLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    if (storedLocale !== locale) {
      setLocaleState(storedLocale);
    }
    // Run only once on mount to hydrate from local preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    return {
      locale,
      setLocale: (nextLocale: Locale) => setLocaleState(normalizeLocale(nextLocale)),
      t: (key, values) => translate(locale, key, values),
      formatDate: (date, options) => {
        const normalizedDate = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(getLocaleCode(locale), options).format(normalizedDate);
      },
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useI18n must be used within a LocaleProvider');
  }

  return context;
}

export { LOCALE_LABELS, DEFAULT_LOCALE };

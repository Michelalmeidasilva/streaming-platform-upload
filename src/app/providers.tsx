'use client';

import { SessionProvider } from 'next-auth/react';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import type { Locale } from '@/lib/i18n/translations';

export default function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

import '../styles/globals.css';
import { cookies } from 'next/headers';
import Providers from './providers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, translate } from '@/lib/i18n/translations';

export async function generateMetadata() {
  const locale = normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);

  return {
    title: translate(locale, 'metadata.title'),
    description: translate(locale, 'metadata.description'),
  };
}

function getInitialLocale() {
  return normalizeLocale(cookies().get(LOCALE_COOKIE)?.value || DEFAULT_LOCALE);
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = getInitialLocale();

  return (
    <html lang={initialLocale}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('theme');
                  const theme = saved || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}

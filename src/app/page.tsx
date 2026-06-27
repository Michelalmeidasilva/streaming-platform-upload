'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import UploadArea from '@/components/UploadArea';
import VideoList from '@/components/VideoList';
import ThemeToggle from '@/components/ThemeToggle';
import LoadingSpinner from '@/components/LoadingSpinner';
import { VideoEventProvider } from '@/lib/context/VideoEventContext';
import { E2E_AUTH_COOKIE } from '@/lib/auth/e2e';
import { useE2ESession } from '@/lib/auth/useE2ESession';
import { LOCALE_LABELS, type Locale } from '@/lib/i18n/translations';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import TranscodeMetrics from '@/components/TranscodeMetrics';
import DistributionMetrics from '@/components/DistributionMetrics';
import StorebenchMetrics from '@/components/StorebenchMetrics';
import BenchmarkLauncher from '@/components/BenchmarkLauncher';

export default function Home() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { effectiveSession, effectiveStatus } = useE2ESession();

  useEffect(() => {
    if (effectiveStatus === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [effectiveStatus, router]);

  useEffect(() => {
    document.title = t('metadata.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('metadata.description'));
  }, [t, locale]);

  // Read the cookie at call time — no need to mirror it as state.
  const handleSignOut = useCallback(() => {
    const hasE2ECookie = document.cookie
      .split('; ')
      .some(row => row.startsWith(`${E2E_AUTH_COOKIE}=`));
    if (hasE2ECookie) {
      document.cookie = `${E2E_AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      window.location.href = '/';
      return;
    }
    void signOut({ callbackUrl: '/' });
  }, []);

  const [view, setView] = useState<'library' | 'metrics' | 'distribution' | 'storage-bench' | 'benchmark'>('library');

  const role = effectiveSession?.user?.role;
  let roleLabel = '';
  if (role === 'ADMIN') roleLabel = t('roles.admin');
  else if (role === 'MEMBER') roleLabel = t('roles.member');

  if (effectiveStatus === 'loading' || effectiveStatus === 'unauthenticated') {
    return (
      <VideoEventProvider>
        <div className={styles.loadingScreen}>
          <LoadingSpinner />
        </div>
      </VideoEventProvider>
    );
  }

  return (
    <VideoEventProvider>
      <div className={styles.app}>
        <nav className={styles.sidebar} aria-label={t('app.sidebar.library')}>
          <div className={styles.sidebarLogo} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="white" aria-hidden="true">
              <path d="M6 4L13 9L6 14V4Z" />
            </svg>
          </div>

          <button
            className={`${styles.navItem} ${view === 'library' ? styles.navItemActive : ''}`}
            type="button"
            aria-label={t('app.sidebar.library')}
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => setView('library')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </button>

          <button
            className={`${styles.navItem} ${view === 'metrics' ? styles.navItemActive : ''}`}
            type="button"
            aria-label={t('app.sidebar.metrics')}
            aria-current={view === 'metrics' ? 'page' : undefined}
            onClick={() => setView('metrics')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v18h18" />
              <rect x="7" y="10" width="3" height="7" />
              <rect x="12" y="6" width="3" height="11" />
              <rect x="17" y="13" width="3" height="4" />
            </svg>
          </button>

          <button
            className={`${styles.navItem} ${view === 'distribution' ? styles.navItemActive : ''}`}
            type="button"
            aria-label={t('app.sidebar.distribution')}
            aria-current={view === 'distribution' ? 'page' : undefined}
            onClick={() => setView('distribution')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <path d="M12 7v4M12 11l-5 6M12 11l5 6" />
            </svg>
          </button>

          <button
            className={`${styles.navItem} ${view === 'storage-bench' ? styles.navItemActive : ''}`}
            type="button"
            aria-label={t('app.sidebar.storageBench')}
            aria-current={view === 'storage-bench' ? 'page' : undefined}
            onClick={() => setView('storage-bench')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
            </svg>
          </button>

          {role === 'ADMIN' && (
            <button
              className={`${styles.navItem} ${view === 'benchmark' ? styles.navItemActive : ''}`}
              type="button"
              aria-label={t('app.sidebar.benchmark')}
              aria-current={view === 'benchmark' ? 'page' : undefined}
              onClick={() => setView('benchmark')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </button>
          )}

          <div className={styles.sidebarSpacer} />

          <button
            className={styles.navItem}
            type="button"
            aria-label={t('app.sidebar.settings')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </nav>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
              {/* Logo mark visible on mobile (sidebar is hidden there) */}
              <div className={styles.topbarLogo} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="white">
                  <path d="M6 4L13 9L6 14V4Z" />
                </svg>
              </div>
              <span className={styles.topbarTitle}>{t('app.topbar.library')}</span>
              <span className={styles.roleBadge}>
                {effectiveSession ? roleLabel : t('auth.signInRequired')}
              </span>
            </div>

            <div className={styles.topbarActions}>
              <ThemeToggle />

              <label className={styles.localeSelectWrap}>
                <span className={styles.srOnly}>{t('locale.label')}</span>
                <select
                  className={styles.localeSelect}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  aria-label={t('locale.label')}
                >
                  {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </label>

              <span className={styles.authStatus}>
                {effectiveSession?.user?.name || effectiveSession?.user?.email}
              </span>
              <button type="button" className={styles.authButton} onClick={handleSignOut}>
                {t('auth.signOut')}
              </button>
            </div>
          </header>

          <main className={styles.content}>
            {view === 'library' ? (
              <>
                <UploadArea />
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>{t('upload.sectionLabel')}</span>
                  <div className={styles.sectionLine} aria-hidden="true" />
                </div>
                <VideoList />
              </>
            ) : view === 'metrics' ? (
              <TranscodeMetrics />
            ) : view === 'distribution' ? (
              <DistributionMetrics />
            ) : view === 'benchmark' && role === 'ADMIN' ? (
              <BenchmarkLauncher />
            ) : (
              <StorebenchMetrics />
            )}
          </main>
        </div>

        {/* Bottom navigation — visible only on mobile (CSS-controlled) */}
        <nav className={styles.mobileNav} aria-label={t('app.sidebar.library')}>
          <button
            type="button"
            className={`${styles.mobileNavItem} ${view === 'library' ? styles.mobileNavItemActive : ''}`}
            aria-label={t('app.sidebar.library')}
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => setView('library')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span className={styles.mobileNavLabel}>{t('app.sidebar.library')}</span>
          </button>
          <button
            type="button"
            className={`${styles.mobileNavItem} ${view === 'metrics' ? styles.mobileNavItemActive : ''}`}
            aria-label={t('app.sidebar.metrics')}
            aria-current={view === 'metrics' ? 'page' : undefined}
            onClick={() => setView('metrics')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v18h18" />
              <rect x="7" y="10" width="3" height="7" />
              <rect x="12" y="6" width="3" height="11" />
              <rect x="17" y="13" width="3" height="4" />
            </svg>
            <span className={styles.mobileNavLabel}>{t('app.sidebar.metrics')}</span>
          </button>
          <button
            type="button"
            className={`${styles.mobileNavItem} ${view === 'distribution' ? styles.mobileNavItemActive : ''}`}
            aria-label={t('app.sidebar.distribution')}
            aria-current={view === 'distribution' ? 'page' : undefined}
            onClick={() => setView('distribution')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <path d="M12 7v4M12 11l-5 6M12 11l5 6" />
            </svg>
            <span className={styles.mobileNavLabel}>{t('app.sidebar.distribution')}</span>
          </button>
          <button
            type="button"
            className={`${styles.mobileNavItem} ${view === 'storage-bench' ? styles.mobileNavItemActive : ''}`}
            aria-label={t('app.sidebar.storageBench')}
            aria-current={view === 'storage-bench' ? 'page' : undefined}
            onClick={() => setView('storage-bench')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
            </svg>
            <span className={styles.mobileNavLabel}>{t('app.sidebar.storageBench')}</span>
          </button>
          {role === 'ADMIN' && (
            <button
              type="button"
              className={`${styles.mobileNavItem} ${view === 'benchmark' ? styles.mobileNavItemActive : ''}`}
              aria-label={t('app.sidebar.benchmark')}
              aria-current={view === 'benchmark' ? 'page' : undefined}
              onClick={() => setView('benchmark')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className={styles.mobileNavLabel}>{t('app.sidebar.benchmark')}</span>
            </button>
          )}
          <button
            type="button"
            className={styles.mobileNavItem}
            aria-label={t('app.sidebar.settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className={styles.mobileNavLabel}>{t('app.sidebar.settings')}</span>
          </button>
        </nav>
      </div>
    </VideoEventProvider>
  );
}

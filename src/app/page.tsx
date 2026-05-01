'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import styles from './page.module.css';
import UploadArea from '@/components/UploadArea';
import VideoList from '@/components/VideoList';
import { VideoEventProvider } from '@/lib/context/VideoEventContext';
import { canUploadVideo } from '@/lib/auth/permissions';
import { createE2ESession, E2E_AUTH_COOKIE } from '@/lib/auth/e2e';

export default function Home() {
  const { data: session, status } = useSession();
  const e2eAuthEnabled = process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED === '1';
  const e2eEmail = process.env.NEXT_PUBLIC_E2E_ADMIN_EMAIL || 'admin-e2e@example.com';
  const [e2eSession, setE2ESession] = useState<ReturnType<typeof createE2ESession> | null | undefined>(
    e2eAuthEnabled ? undefined : null,
  );

  useEffect(() => {
    if (!e2eAuthEnabled) {
      setE2ESession(null);
      return;
    }

    const cookieValue = document.cookie
      .split('; ')
      .find(cookie => cookie.startsWith(`${E2E_AUTH_COOKIE}=`))
      ?.split('=')
      .slice(1)
      .join('=');

    setE2ESession(cookieValue ? createE2ESession(decodeURIComponent(cookieValue)) : null);
  }, [e2eAuthEnabled]);

  const effectiveSession = e2eSession || session;
  const effectiveStatus = e2eSession === undefined ? 'loading' : e2eSession ? 'authenticated' : status;
  const role = effectiveSession?.user?.role;
  const isAdmin = canUploadVideo(role);
  const signInAsE2EAdmin = async () => {
    document.cookie = `${E2E_AUTH_COOKIE}=${encodeURIComponent(e2eEmail)}; path=/; SameSite=Lax`;
    setE2ESession(createE2ESession(e2eEmail));
    window.location.href = '/';
  };
  const handleSignOut = () => {
    if (e2eSession) {
      document.cookie = `${E2E_AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      window.location.href = '/';
      return;
    }

    void signOut({ callbackUrl: '/' });
  };

  return (
    <VideoEventProvider>
      <div className={styles.app}>
        <nav className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
              <path d="M6 4L13 9L6 14V4Z" />
            </svg>
          </div>

          <div className={`${styles.navItem} ${styles.navItemActive}`} title="Biblioteca">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>

          <div className={styles.navItem} title="Upload">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <div className={styles.navItem} title="Dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>

          <div className={styles.sidebarSpacer} />

          <div className={styles.navItem} title="Configurações">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
        </nav>

        <div className={styles.main}>
          <div className={styles.topbar}>
            <div className={styles.topbarLeft}>
              <span className={styles.topbarTitle}>Biblioteca</span>
              <span className={styles.roleBadge}>
                {effectiveStatus === 'loading' ? 'LOADING' : effectiveSession ? role : 'SIGN IN REQUIRED'}
              </span>
            </div>

            <div className={styles.topbarActions}>
              {effectiveStatus === 'loading' ? (
                <span className={styles.authStatus}>Loading session...</span>
              ) : effectiveSession ? (
                <>
                  <span className={styles.authStatus}>
                    {effectiveSession.user?.name || effectiveSession.user?.email}
                  </span>
                  <button className={styles.authButton} onClick={handleSignOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.authButton} onClick={() => signIn('google')}>
                    Sign in with Google
                  </button>
                  {e2eAuthEnabled ? (
                    <button className={styles.authButton} onClick={signInAsE2EAdmin}>
                      Sign in as E2E admin
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className={styles.content}>
            {!effectiveSession ? (
              <section className={styles.hero}>
                <p className={styles.heroEyebrow}>Secure access</p>
                <h1 className={styles.heroTitle}>Google sign-in protects uploads, edits, and downloads.</h1>
                <p className={styles.heroCopy}>
                  Members can browse and download. Admins can upload, rename, and delete videos. The server enforces the boundary either way.
                </p>
                <div className={styles.heroActions}>
                  <button className={styles.primaryButton} onClick={() => signIn('google')}>
                    Sign in with Google
                  </button>
                  {e2eAuthEnabled ? (
                    <button className={styles.primaryButton} onClick={signInAsE2EAdmin}>
                      Sign in as E2E admin
                    </button>
                  ) : null}
                </div>
              </section>
            ) : (
              <section className={styles.statusPanel}>
                <div>
                  <p className={styles.statusLabel}>Session</p>
                  <p className={styles.statusValue}>{effectiveSession.user?.email}</p>
                </div>
                <div>
                  <p className={styles.statusLabel}>Role</p>
                  <p className={styles.statusValue}>{role}</p>
                </div>
                <div>
                  <p className={styles.statusLabel}>Capabilities</p>
                  <p className={styles.statusValue}>
                    {isAdmin ? 'Upload, edit, delete, view, search, download' : 'View, search, download'}
                  </p>
                </div>
              </section>
            )}

            <UploadArea />

            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Vídeos</span>
              <div className={styles.sectionLine} />
            </div>

            <VideoList />
          </div>
        </div>
      </div>
    </VideoEventProvider>
  );
}

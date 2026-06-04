'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import styles from './VideoList.module.css';
import Skeleton from './Skeleton';
import { useVideoEvents } from '@/lib/context/VideoEventContext';
import { canDeleteVideo, canViewVideo } from '@/lib/auth/permissions';
import VideoModal from './VideoModal';
import { useE2ESession } from '@/lib/auth/useE2ESession';
import { useI18n } from '@/lib/i18n/LocaleProvider';

interface Video {
  id: string;
  title: string;
  originalName: string;
  size: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  thumbnailStatus?: string;
  processingStatus?: string;
}

export default function VideoList() {
  const { effectiveSession, effectiveStatus: effectiveSessionStatus } = useE2ESession();
  const { t, formatDate } = useI18n();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loadError, setLoadError] = useState<'signIn' | 'generic' | null>(null);
  const { onUploadComplete, unsubscribe } = useVideoEvents();
  const canBrowse = canViewVideo(effectiveSession?.user?.role);
  const canManageVideos = canDeleteVideo(effectiveSession?.user?.role);

  const fetchVideos = useCallback(async (query = '') => {
    if (!canBrowse) {
      setVideos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const url = query ? `/api/videos?q=${encodeURIComponent(query)}` : '/api/videos';
      const response = await fetch(url, { credentials: 'include' });

      if (response.status === 401) {
        setVideos([]);
        setLoadError('signIn');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load videos (${response.status})`);
      }

      const data = await response.json();
      const raw: Video[] = data.videos || [];
      const seen = new Set<string>();
      setVideos(raw.filter(v => seen.has(v.id) ? false : seen.add(v.id) as unknown as true));
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      setLoadError('generic');
    } finally {
      setLoading(false);
    }
  }, [canBrowse]);

  useEffect(() => {
    const handleUploadComplete = () => {
      if (effectiveSessionStatus === 'authenticated') {
        fetchVideos(search);
      }
    };

    onUploadComplete(handleUploadComplete);

    return () => {
      unsubscribe(handleUploadComplete);
    };
  }, [effectiveSessionStatus, onUploadComplete, search, unsubscribe, fetchVideos]);

  useEffect(() => {
    if (effectiveSessionStatus !== 'authenticated') {
      setVideos([]);
      setLoading(effectiveSessionStatus === 'loading');
      return;
    }

    const timer = setTimeout(() => {
      fetchVideos(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [effectiveSessionStatus, search, fetchVideos]);

  useEffect(() => {
    if (effectiveSessionStatus !== 'authenticated') return;
    const es = new EventSource('/api/videos/stream', { withCredentials: true });
    es.addEventListener('video-updated', (e) => {
      const u = JSON.parse((e as MessageEvent).data) as {
        id: string; status: string; processingStatus: string | null;
        thumbnailStatus: string | null; thumbnailUrl: string | null;
      };
      setVideos((prev) =>
        prev.map((v) =>
          v.id === u.id
            ? {
                ...v,
                status: u.status,
                processingStatus: u.processingStatus ?? v.processingStatus,
                thumbnailStatus: u.thumbnailStatus ?? v.thumbnailStatus,
                thumbnailUrl: u.thumbnailUrl ?? v.thumbnailUrl,
              }
            : v,
        ),
      );
    });
    return () => es.close();
  }, [effectiveSessionStatus, setVideos]);

  const initialLoadingSkeletonIds = useMemo(
    () => Array.from({ length: 4 }, () => crypto.randomUUID()),
    []
  );

  const mainLoadingSkeletonIds = useMemo(
    () => Array.from({ length: 6 }, () => crypto.randomUUID()),
    []
  );

  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} ${t('library.formats.sizeBytes')}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t('library.formats.sizeKilobytes')}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${t('library.formats.sizeMegabytes')}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${t('library.formats.sizeGigabytes')}`;
  }, [t]);

  const handleDelete = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Delete failed (${response.status})`);
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  }, []);

  const handleCloseModal = useCallback(() => setSelectedVideo(null), []);

  if (effectiveSessionStatus === 'loading') {
    return (
      <div className={styles.grid}>
        {initialLoadingSkeletonIds.map((id) => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="180px" variant="rect" />
            <Skeleton height="16px" width="80%" />
            <Skeleton height="12px" width="60%" />
          </div>
        ))}
      </div>
    );
  }

  if (!effectiveSession) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <h3>{t('library.signInToView')}</h3>
        <p>{t('library.signInToViewCopy')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.searchContainer}>
          <div className={styles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={t('library.search.placeholder')}
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadError && (
        <div className={styles.errorBanner}>
          <p>{t(`library.loadError.${loadError}`)}</p>
        </div>
      )}

      {loading && (
        <div className={styles.grid}>
          {mainLoadingSkeletonIds.map((id) => (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton height="180px" variant="rect" />
              <Skeleton height="16px" width="80%" />
              <Skeleton height="12px" width="60%" />
            </div>
          ))}
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h3>{search ? t('library.empty.searchTitle') : t('library.empty.emptyTitle')}</h3>
          <p>{search ? t('library.empty.searchCopy', { query: search }) : t('library.empty.emptyCopy')}</p>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className={styles.grid}>
          {videos.map(video => (
            <div
              key={video.id}
              role="button"
              tabIndex={0}
              className={styles.card}
              onClick={() => setSelectedVideo(video)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedVideo(video); } }}
              aria-label={video.title}
            >
              <div className={styles.thumbnail}>
                <Image
                  src={video.thumbnailUrl || '/default-thumbnail.png'}
                  alt={video.title}
                  fill
                  className={styles.thumbnailImage}
                  style={{ objectFit: 'cover' }}
                />
                <div className={styles.playBtn}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="white">
                    <path d="M4 2L9 6L4 10V2z" />
                  </svg>
                </div>
                {video.status === 'uploading' && (
                  <div className={styles.thumbProgress}>
                    <div className={styles.thumbProgressFill} />
                  </div>
                )}
              </div>

              <div className={styles.info}>
                <h3 className={styles.title}>{video.title}</h3>
                <div className={styles.meta}>
                  <span>{formatSize(video.size)}</span>
                  <span>·</span>
                  <span>{formatDate(video.createdAt)}</span>
                </div>
                <div className={styles.footer}>
                  <span className={`${styles.statusBadge} ${styles[video.status]}`}>
                    {video.status === 'ready' && t('library.status.ready')}
                    {video.status === 'processing' && t('library.status.processing')}
                    {video.status === 'uploading' && t('library.status.uploading')}
                    {video.status === 'error' && t('library.status.error')}
                  </span>
                  {canManageVideos ? (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(video.id);
                      }}
                    >
                      {t('library.actions.delete')}
                    </button>
                  ) : (
                    <span className={styles.memberLabel}>{t('library.memberOnly')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedVideo && (
        <VideoModal
          isOpen={selectedVideo !== null}
          video={selectedVideo}
          canManageVideos={canManageVideos}
          onClose={handleCloseModal}
          onDeleted={(videoId) => {
            setVideos(prev => prev.filter(video => video.id !== videoId));
            handleCloseModal();
          }}
          onUpdated={(updated) => {
            setVideos(prev => prev.map(video => (video.id === updated.id ? updated : video)));
            setSelectedVideo(updated);
          }}
        />
      )}
    </div>
  );
}

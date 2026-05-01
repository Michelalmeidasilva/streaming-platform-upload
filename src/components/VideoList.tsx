'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './VideoList.module.css';
import { useVideoEvents } from '@/lib/context/VideoEventContext';
import { canDeleteVideo, canViewVideo } from '@/lib/auth/permissions';
import VideoModal from './VideoModal';
import { createE2ESession, E2E_AUTH_COOKIE } from '@/lib/auth/e2e';

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
}

export default function VideoList() {
  const { data: session, status: sessionStatus } = useSession();
  const e2eAuthEnabled = process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED === '1';
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
  const effectiveSessionStatus = e2eSession === undefined ? 'loading' : e2eSession ? 'authenticated' : sessionStatus;
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { onUploadComplete, unsubscribe } = useVideoEvents();
  const canBrowse = canViewVideo(effectiveSession?.user?.role);
  const canManageVideos = canDeleteVideo(effectiveSession?.user?.role);

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
  }, [effectiveSessionStatus, onUploadComplete, search, unsubscribe]);

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
  }, [effectiveSessionStatus, search]);

  const fetchVideos = async (query = '') => {
    if (!canBrowse) {
      setVideos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const url = query ? `/api/videos?q=${encodeURIComponent(query)}` : '/api/videos';
      const response = await fetch(url);

      if (response.status === 401) {
        setVideos([]);
        setLoadError('Sign in to browse the library.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load videos (${response.status})`);
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      setLoadError('Unable to load videos right now.');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }

      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  };

  const handleCloseModal = () => {
    setSelectedVideo(null);
  };

  if (effectiveSessionStatus === 'loading') {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading session...</p>
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
        <h3>Sign in to view videos</h3>
        <p>Authenticated members can search and download the library.</p>
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
            placeholder="Search your videos..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadError && (
        <div className={styles.errorBanner}>
          <p>{loadError}</p>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Searching videos...</p>
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
          <h3>{search ? 'Nenhum resultado encontrado' : 'Nenhum vídeo ainda'}</h3>
          <p>{search ? `Não encontramos nada para "${search}"` : 'Importe seu primeiro arquivo para começar'}</p>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className={styles.grid}>
          {videos.map(video => (
            <div
              key={video.id}
              className={styles.card}
              onClick={() => setSelectedVideo(video)}
            >
              <div className={styles.thumbnail}>
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.title} className={styles.thumbnailImage} />
                ) : null}
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
                    {video.status === 'ready' && 'Ready'}
                    {video.status === 'processing' && 'Process'}
                    {video.status === 'uploading' && 'Uploading'}
                    {video.status === 'error' && 'Erro'}
                  </span>
                  {canManageVideos ? (
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(video.id);
                      }}
                    >
                      Excluir
                    </button>
                  ) : (
                    <span className={styles.memberLabel}>Download only</span>
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

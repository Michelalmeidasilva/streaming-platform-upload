'use client';

import { useState, useEffect } from 'react';
import styles from './VideoList.module.css';

interface Video {
  id: string;
  originalName: string;
  size: number;
  status: string;
  createdAt: string;
}

export default function VideoList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVideos(search);
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [search]);

  const fetchVideos = async (query = '') => {
    try {
      setLoading(true);
      const url = query ? `/api/videos?q=${encodeURIComponent(query)}` : '/api/videos';
      const response = await fetch(url);
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
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
      await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });
      setVideos(prev => prev.filter(v => v.id !== videoId));
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  };


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
          {!search && <button className={styles.emptyBtn}>+ Importar vídeo</button>}
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className={styles.grid}>
          {videos.map(video => (
            <div key={video.id} className={styles.card}>
              <div className={styles.thumbnail}>
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
                <h3 className={styles.title}>{video.originalName}</h3>
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
                  <button className={styles.deleteBtn} onClick={() => handleDelete(video.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

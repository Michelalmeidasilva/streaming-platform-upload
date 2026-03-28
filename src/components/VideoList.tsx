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

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos');
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

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading videos...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="16" width="48" height="36" rx="4" stroke="var(--color-border)" strokeWidth="2" />
          <path d="M8 28L24 20L32 28L44 16L56 28" stroke="var(--color-border)" strokeWidth="2" />
          <circle cx="44" cy="40" r="8" stroke="var(--color-border)" strokeWidth="2" />
          <path d="M40 40L44 44L50 36" stroke="var(--color-border)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>No videos yet</p>
        <span>Upload your first video to get started</span>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {videos.map(video => (
        <div key={video.id} className={styles.card}>
          <div className={styles.thumbnail}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M12 10L22 16L12 22V10Z" fill="var(--color-primary)" />
            </svg>
          </div>
          
          <div className={styles.content}>
            <h3 className={styles.title}>{video.originalName}</h3>
            
            <div className={styles.meta}>
              <span>{formatSize(video.size)}</span>
              <span>•</span>
              <span>{formatDate(video.createdAt)}</span>
            </div>
            
            <div className={styles.footer}>
              <span className={`${styles.status} ${styles[video.status]}`}>
                {video.status === 'ready' && 'Ready'}
                {video.status === 'processing' && 'Processing'}
                {video.status === 'uploading' && 'Uploading'}
                {video.status === 'error' && 'Error'}
              </span>
              
              <button 
                className={styles.deleteBtn}
                onClick={() => handleDelete(video.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

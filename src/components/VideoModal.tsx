'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './VideoModal.module.css';
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
}

interface VideoModalProps {
  isOpen: boolean;
  video: Video;
  canManageVideos: boolean;
  onClose: () => void;
  onDeleted: (videoId: string) => void;
  onUpdated: (video: Video) => void;
}

export default function VideoModal({
  isOpen,
  video,
  canManageVideos,
  onClose,
  onDeleted,
  onUpdated,
}: VideoModalProps) {
  const [title, setTitle] = useState(video.title);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    setTitle(video.title);
  }, [video.title]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      const data = await response.json();
      onUpdated(data.video);
    } catch (error) {
      console.error('Failed to save video title:', error);
    } finally {
      setSaving(false);
    }
  }, [onUpdated, title, video.id]);

  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }

      onDeleted(video.id);
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  }, [onDeleted, video.id]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <h2 className={styles.title}>{canManageVideos ? t('modal.manageVideo') : video.title}</h2>
            <p className={styles.subtitle}>{video.originalName}</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('modal.closeLabel')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.playerContainer}>
          <video
            className={styles.player}
            src={video.downloadUrl}
            controls
            autoPlay
          />
        </div>
        <div className={styles.footer}>
          <a className={styles.downloadButton} href={video.downloadUrl} download={video.originalName}>
            {t('modal.download')}
          </a>
          {canManageVideos ? (
            <div className={styles.manageGroup}>
              <input
                className={styles.titleInput}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label={t('modal.titleLabel')}
              />
              <button className={styles.secondaryButton} onClick={handleSave} disabled={saving}>
                {saving ? t('modal.saving') : t('modal.saveTitle')}
              </button>
              <button className={styles.dangerButton} onClick={handleDelete}>
                {t('modal.delete')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback } from 'react';
import styles from './VideoModal.module.css';

interface VideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  videoName: string;
  onClose: () => void;
}

export default function VideoModal({ isOpen, videoUrl, videoName, onClose }: VideoModalProps) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{videoName}</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close video player"
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
            src={videoUrl}
            controls
            autoPlay
          />
        </div>
      </div>
    </div>
  );
}

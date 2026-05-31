'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './UploadArea.module.css';
import Skeleton from './Skeleton';
import { validateCMAFFile } from '@/lib/cmaf';
import { useVideoEvents } from '@/lib/context/VideoEventContext';
import { canUploadVideo } from '@/lib/auth/permissions';
import { useE2ESession } from '@/lib/auth/useE2ESession';
import { useI18n } from '@/lib/i18n/LocaleProvider';

interface UploadProgress {
  videoId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'queued' | 'transcoding' | 'packaging' | 'ready' | 'error';
}

function isDirectUploadEnabled() {
  return process.env.NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED === 'true';
}

const generateThumbnail = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.25 || 1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const ratio = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const nw = video.videoWidth * ratio;
        const nh = video.videoHeight * ratio;
        const x = (canvas.width - nw) / 2;
        const y = (canvas.height - nh) / 2;
        ctx.drawImage(video, x, y, nw, nh);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(null);
      }
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(video.src);
    };
  });
};

export default function UploadArea() {
  const directUploadEnabled = isDirectUploadEnabled();
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const { emitUploadComplete } = useVideoEvents();
  const { effectiveSession, effectiveStatus } = useE2ESession();
  const isAdmin = canUploadVideo(effectiveSession?.user?.role);

  const setStatus = useCallback(
    (videoId: string, patch: Partial<UploadProgress>) =>
      setUploads(prev => prev.map(u => (u.videoId === videoId ? { ...u, ...patch } : u))),
    [],
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        const validation = validateCMAFFile(file);
        if (!validation.valid) {
          if (validation.errorKey === 'unsupportedFormat') {
            alert(t('upload.validation.unsupportedFormat', { formats: '.mp4, .mov, .m4v, .webm, .m3u8' }));
          } else if (validation.errorKey === 'fileTooLarge') {
            alert(t('upload.validation.fileTooLarge'));
          }
          continue;
        }

        const videoId = `video-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        setUploads(prev => [...prev, { videoId, filename: file.name, progress: 0, status: 'uploading' }]);

        try {
          // Generate thumbnail immediately
          const thumbnailPromise = generateThumbnail(file);

          // 1. Initiate upload session
          const initRes = await fetch('/api/upload', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, size: file.size, mimeType: file.type }),
          });
          if (!initRes.ok) throw new Error(t('upload.errors.initiate'));
          const { sessionId, chunkSize, totalChunks, presignedUrls } = await initRes.json();

          // 2. Upload chunks in parallel (max 6 concurrent)
          const CONCURRENCY = 6;
          const etags: { PartNumber: number; ETag: string }[] = [];
          let completedChunks = 0;
          let useServerUpload = !directUploadEnabled;

          const uploadChunk = async (i: number) => {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunkBlob = file.slice(start, end);

            let chunkRes: Response;

            if (!useServerUpload) {
              try {
                chunkRes = await fetch(presignedUrls[i], {
                  method: 'PUT',
                  body: chunkBlob,
                });

                if (!chunkRes.ok) {
                  throw new Error(`Direct upload failed with status ${chunkRes.status}`);
                }
              } catch (error) {
                console.warn('Direct S3 upload failed, falling back to server upload', error);
                useServerUpload = true;
                chunkRes = await fetch(`/api/upload/chunk?sessionId=${encodeURIComponent(sessionId)}&chunkIndex=${i}`, {
                  method: 'POST',
                  credentials: 'include',
                  body: chunkBlob,
                });
              }
            } else {
              chunkRes = await fetch(`/api/upload/chunk?sessionId=${encodeURIComponent(sessionId)}&chunkIndex=${i}`, {
                method: 'POST',
                credentials: 'include',
                body: chunkBlob,
              });
            }

            if (!chunkRes.ok) throw new Error(t('upload.errors.chunk', { index: i + 1 }));

            const etag = chunkRes.headers.get('ETag');
            if (!useServerUpload && etag) {
              etags.push({ PartNumber: i + 1, ETag: etag.replace(/"/g, '') });
            }

            completedChunks += 1;
            setStatus(videoId, { progress: (completedChunks / totalChunks) * 100 });
          };

          const indices = Array.from({ length: totalChunks }, (_, i) => i);
          for (let offset = 0; offset < indices.length; offset += CONCURRENCY) {
            await Promise.all(indices.slice(offset, offset + CONCURRENCY).map(uploadChunk));
          }

          // 3. Complete upload
          const thumbnailBase64 = await thumbnailPromise;
          const completeRes = await fetch('/api/upload/complete', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, etags, thumbnail: thumbnailBase64 }),
          });
          if (!completeRes.ok) throw new Error(t('upload.errors.complete'));

          setStatus(videoId, { progress: 100, status: 'processing' });
          emitUploadComplete();
        } catch (error) {
          console.error('Upload flow failed:', error);
          setStatus(videoId, { status: 'error' });
        }
      }
    },
    [setStatus, emitUploadComplete, t, directUploadEnabled],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    },
    [handleFiles],
  );

  const removeUpload = useCallback(
    (videoId: string) => setUploads(prev => prev.filter(u => u.videoId !== videoId)),
    [],
  );

  if (effectiveStatus === 'loading') {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton height="240px" variant="rect" />
          <Skeleton height="16px" width="40%" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.lockedState}>
          <p className={styles.lockedLabel}>{t('auth.memberAccess')}</p>
          <h3>{t('auth.uploadsAdminOnly')}</h3>
          <p>{t('auth.memberBrowseCopy')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        aria-label={t('upload.dropzone.idleTitle')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.m4v,.webm,.m3u8"
          multiple
          onChange={handleInputChange}
          className={styles.fileInput}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className={styles.dropzoneContent}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className={styles.dropzoneText}>
            <h3>{isDragging ? t('upload.dropzone.activeTitle') : t('upload.dropzone.idleTitle')}</h3>
            <p>{isDragging ? t('upload.dropzone.activeCopy') : t('upload.dropzone.idleCopy')}</p>
          </div>
          <div className={styles.formats}>
            <span className={styles.formatLabel}>{t('upload.dropzone.formats')}</span>
            <span className={styles.formatBadge}>MP4</span>
            <span className={styles.formatBadge}>MOV</span>
            <span className={styles.formatBadge}>M4V</span>
            <span className={styles.formatBadge}>WEBM</span>
          </div>
        </div>
      </button>

      {uploads.length > 0 && (
        <div className={styles.uploadsList}>
          {uploads.map(upload => (
            <div key={upload.videoId} className={`${styles.uploadCard} ${styles[upload.status]}`}>
              <div className={styles.fileIcon}>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4 2L8 6L4 10V2z" />
                </svg>
              </div>
              <div className={styles.fileDetails}>
                <p className={styles.fileName}>{upload.filename}</p>
                <div className={styles.progressContainer}>
                  <div className={styles.progressBar} style={{ width: `${upload.progress}%` }} />
                </div>
              </div>
              <div className={styles.uploadActions}>
                <span className={`${styles.statusBadge} ${styles[upload.status]}`}>
                  {upload.status === 'uploading' && t('upload.uploadStatus.uploading', { progress: Math.round(upload.progress) })}
                  {upload.status === 'processing' && t('upload.uploadStatus.processing')}
                  {upload.status === 'ready' && t('upload.uploadStatus.ready')}
                  {upload.status === 'error' && t('upload.uploadStatus.error')}
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={e => { e.stopPropagation(); removeUpload(upload.videoId); }}
                  aria-label={t('upload.actions.remove')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

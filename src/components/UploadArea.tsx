'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import styles from './UploadArea.module.css';
import { validateCMAFFile } from '@/lib/cmaf';
import { useVideoEvents } from '@/lib/context/VideoEventContext';
import { canUploadVideo } from '@/lib/auth/permissions';

interface UploadProgress {
  videoId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
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
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { emitUploadComplete } = useVideoEvents();
  const { data: session, status } = useSession();
  const isAdmin = canUploadVideo(session?.user?.role);

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
          alert(validation.error);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, size: file.size, mimeType: file.type }),
          });
          if (!initRes.ok) throw new Error('Failed to initiate upload');
          const { sessionId, chunkSize, totalChunks, presignedUrls } = await initRes.json();

          // 2. Upload each chunk sequentially
          const etags: { PartNumber: number; ETag: string }[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunkBlob = file.slice(start, end);

            const chunkRes = await fetch(presignedUrls[i], { 
              method: 'PUT', 
              body: chunkBlob 
            });
            if (!chunkRes.ok) throw new Error(`Chunk ${i} upload failed`);

            const etag = chunkRes.headers.get('ETag');
            if (etag) {
              etags.push({ PartNumber: i + 1, ETag: etag.replace(/"/g, '') });
            }

            setStatus(videoId, { progress: ((i + 1) / totalChunks) * 100 });
          }

          // 3. Complete upload
          const thumbnailBase64 = await thumbnailPromise;
          const completeRes = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, etags, thumbnail: thumbnailBase64 }),
          });
          if (!completeRes.ok) throw new Error('Failed to complete upload');

          setStatus(videoId, { progress: 100, status: 'processing' });
          setTimeout(() => {
            setStatus(videoId, { status: 'ready' });
            emitUploadComplete();
          }, 2000);
        } catch {
          setStatus(videoId, { status: 'error' });
        }
      }
    },
    [setStatus, emitUploadComplete],
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

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.lockedState}>
          <p className={styles.lockedLabel}>Loading session</p>
          <h3>Checking access</h3>
          <p>Preparing role-aware upload controls.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.lockedState}>
          <p className={styles.lockedLabel}>Sign in required</p>
          <h3>Upload controls are protected</h3>
          <p>Use Google sign-in to access admin upload actions.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.lockedState}>
          <p className={styles.lockedLabel}>Member access</p>
          <h3>Uploads are available to admins only</h3>
          <p>You can still browse and download videos from the library.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.m4v,.webm,.m3u8"
          multiple
          onChange={handleInputChange}
          className={styles.fileInput}
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
            <h3>{isDragging ? 'Solte para iniciar o upload' : 'Arraste arquivos de vídeo aqui'}</h3>
            <p>{isDragging ? 'Arquivos detectados' : 'ou clique para selecionar'}</p>
          </div>
          <div className={styles.formats}>
            <span className={styles.formatBadge}>MP4</span>
            <span className={styles.formatBadge}>MOV</span>
            <span className={styles.formatBadge}>M4V</span>
            <span className={styles.formatBadge}>WEBM</span>
          </div>
        </div>
      </div>

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
                  {upload.status === 'uploading' && `${Math.round(upload.progress)}%`}
                  {upload.status === 'processing' && 'Processando'}
                  {upload.status === 'ready' && 'Pronto'}
                  {upload.status === 'error' && 'Erro'}
                </span>
                <button
                  className={styles.removeBtn}
                  onClick={e => { e.stopPropagation(); removeUpload(upload.videoId); }}
                  aria-label="Remover"
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

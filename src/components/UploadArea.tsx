'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './UploadArea.module.css';
import { validateCMAFFile } from '@/lib/cmaf';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB — must match server CHUNK_SIZE

interface UploadProgress {
  videoId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
}

export default function UploadArea() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const videoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setUploads(prev => [...prev, { videoId, filename: file.name, progress: 0, status: 'uploading' }]);

        try {
          // 1. Initiate upload session
          const initRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, size: file.size, mimeType: file.type }),
          });
          if (!initRes.ok) throw new Error('Failed to initiate upload');
          const { sessionId, chunkSize, totalChunks } = await initRes.json();

          // 2. Upload each chunk sequentially
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunkBlob = file.slice(start, end);

            const formData = new FormData();
            formData.append('sessionId', sessionId);
            formData.append('chunkIndex', String(i));
            formData.append('chunk', chunkBlob);

            const chunkRes = await fetch('/api/upload/chunk', { method: 'POST', body: formData });
            if (!chunkRes.ok) throw new Error(`Chunk ${i} upload failed`);

            setStatus(videoId, { progress: ((i + 1) / totalChunks) * 100 });
          }

          // 3. Complete upload
          const completeRes = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          if (!completeRes.ok) throw new Error('Failed to complete upload');

          setStatus(videoId, { progress: 100, status: 'processing' });
          setTimeout(() => setStatus(videoId, { status: 'ready' }), 2000);
        } catch {
          setStatus(videoId, { status: 'error' });
        }
      }
    },
    [setStatus],
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
          <svg className={styles.icon} width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L12 16H18V32H30V16H36L24 4Z" fill="currentColor" />
            <path d="M4 36V44H44V36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className={styles.dropzoneText}>Drag and drop your video here</p>
          <p className={styles.dropzoneSubtext}>or click to browse</p>
          <div className={styles.formats}>
            <span>Supported formats:</span>
            <span className={styles.formatBadge}>MP4</span>
            <span className={styles.formatBadge}>MOV</span>
            <span className={styles.formatBadge}>M4V</span>
            <span className={styles.formatBadge}>WebM</span>
          </div>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className={styles.uploadsList}>
          {uploads.map(upload => (
            <div key={upload.videoId} className={styles.uploadCard}>
              <div className={styles.uploadInfo}>
                <div className={styles.fileIcon}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2L4 8H8V14H12V8H16L10 2Z" fill="var(--color-primary)" />
                  </svg>
                </div>
                <div className={styles.fileDetails}>
                  <p className={styles.fileName}>{upload.filename}</p>
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar} style={{ width: `${upload.progress}%` }} />
                  </div>
                  <span className={styles.progressText}>{Math.round(upload.progress)}%</span>
                </div>
              </div>
              <div className={styles.uploadActions}>
                <span className={`${styles.status} ${styles[upload.status]}`}>
                  {upload.status === 'uploading' && 'Uploading'}
                  {upload.status === 'processing' && 'Processing'}
                  {upload.status === 'ready' && 'Ready'}
                  {upload.status === 'error' && 'Error'}
                </span>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeUpload(upload.videoId)}
                  aria-label="Remove"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M12 4L4 12M4 4L12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
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

'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './UploadArea.module.css';
import { validateCMAFFile } from '@/lib/cmaf';

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

        const videoId = `video-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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

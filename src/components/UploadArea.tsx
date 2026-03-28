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

  const handleFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const validation = validateCMAFFile(file);
      
      if (!validation.valid) {
        alert(validation.error);
        continue;
      }

      const videoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const uploadProgress: UploadProgress = {
        videoId,
        filename: file.name,
        progress: 0,
        status: 'uploading',
      };
      
      setUploads(prev => [...prev, uploadProgress]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploads(prev => 
              prev.map(u => 
                u.videoId === videoId 
                  ? { ...u, progress } 
                  : u
              )
            );
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploads(prev => 
              prev.map(u => 
                u.videoId === videoId 
                  ? { ...u, progress: 100, status: 'processing' } 
                  : u
              )
            );
            
            setTimeout(() => {
              setUploads(prev => 
                prev.map(u => 
                  u.videoId === videoId 
                    ? { ...u, status: 'ready' } 
                    : u
                )
              );
            }, 2000);
          } else {
            setUploads(prev => 
              prev.map(u => 
                u.videoId === videoId 
                  ? { ...u, status: 'error' } 
                  : u
              )
            );
          }
        });
        
        xhr.addEventListener('error', () => {
          setUploads(prev => 
            prev.map(u => 
              u.videoId === videoId 
                ? { ...u, status: 'error' } 
                : u
            )
          );
        });
        
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
        
      } catch (error) {
        setUploads(prev => 
          prev.map(u => 
            u.videoId === videoId 
              ? { ...u, status: 'error' } 
              : u
          )
        );
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeUpload = useCallback((videoId: string) => {
    setUploads(prev => prev.filter(u => u.videoId !== videoId));
  }, []);

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
          <svg 
            className={styles.icon} 
            width="48" 
            height="48" 
            viewBox="0 0 48 48" 
            fill="none"
          >
            <path 
              d="M24 4L12 16H18V32H30V16H36L24 4Z" 
              fill="currentColor"
            />
            <path 
              d="M4 36V44H44V36" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
            />
          </svg>
          
          <p className={styles.dropzoneText}>
            Drag and drop your video here
          </p>
          <p className={styles.dropzoneSubtext}>
            or click to browse
          </p>
          
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
                    <path 
                      d="M10 2L4 8H8V14H12V8H16L10 2Z" 
                      fill="var(--color-primary)"
                    />
                  </svg>
                </div>
                <div className={styles.fileDetails}>
                  <p className={styles.fileName}>{upload.filename}</p>
                  <div className={styles.progressContainer}>
                    <div 
                      className={styles.progressBar} 
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <span className={styles.progressText}>
                    {Math.round(upload.progress)}%
                  </span>
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

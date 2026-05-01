import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from '@/lib/storage';
import { videoEvents } from '@/lib/VideoEventEmitter';
import {
  RecoveryPolicy,
  SecurityPosture,
  StorageSecurityPolicy,
  Video,
  UploadSession,
  VideoStatus,
} from '@/types';
import { ThumbnailExtractor } from './ThumbnailExtractor';
import { getRecoveryPolicy } from '@/lib/security/recovery-policy';
import { resolveStoragePolicy } from '@/lib/security/storage-policy';

const MIN_MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;

function resolveChunkSize() {
  const parsed = Number.parseInt(process.env.UPLOAD_CHUNK_SIZE_BYTES || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CHUNK_SIZE;
  }

  return Math.max(parsed, MIN_MULTIPART_CHUNK_SIZE);
}

export class UploadService {
  private storage: IStorageAdapter;
  private videos: Map<string, Video> = new Map();
  private sessions: Map<string, UploadSession> = new Map();
  private thumbnailExtractor: ThumbnailExtractor;
  private storagePolicy: StorageSecurityPolicy;
  private recoveryPolicy: RecoveryPolicy;
  private securityPosture: SecurityPosture;

  constructor(storage: IStorageAdapter, securityPosture?: SecurityPosture) {
    this.storage = storage;
    this.storagePolicy = securityPosture?.storage || resolveStoragePolicy();
    this.recoveryPolicy = securityPosture?.recovery || getRecoveryPolicy();
    this.securityPosture = securityPosture || {
      storage: this.storagePolicy,
      recovery: this.recoveryPolicy,
    };
    this.thumbnailExtractor = new ThumbnailExtractor(storage, videoEvents);

    // Listen for thumbnail events and update video (using NodeEventEmitter base methods)
    videoEvents.on('video.thumbnail.generated' as any, (data: any) => {
      const video = this.videos.get(data.videoId);
      if (video) {
        video.thumbnailUrl = data.thumbnailUrl;
        video.thumbnailStatus = 'ready';
        video.updatedAt = new Date();
      }
    });

    videoEvents.on('video.thumbnail.fallback' as any, (data: any) => {
      const video = this.videos.get(data.videoId);
      if (video) {
        video.thumbnailUrl = data.thumbnailUrl;
        video.thumbnailStatus = 'failed';
        video.updatedAt = new Date();
      }
    });
  }

  async initiateUpload(
    filename: string,
    size: number,
    mimeType?: string,
  ): Promise<{ sessionId: string; videoId: string; chunkSize: number; totalChunks: number; presignedUrls: string[] }> {
    const chunkSize = resolveChunkSize();
    const videoId = uuidv4();
    const sessionId = uuidv4();
    const totalChunks = Math.ceil(size / chunkSize);
    const key = `${videoId}/${filename}`;
    const contentType = mimeType || 'application/octet-stream';

    const video: Video = {
      id: videoId,
      filename: key,
      originalName: filename,
      title: filename,
      size,
      status: 'uploading',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      mimeType,
      securityPosture: this.securityPosture,
    };

    const presignedUrls: string[] = [];
    let uploadId = '';

    if (totalChunks === 1) {
      const url = await this.storage.getUploadPresignedUrl(
        key,
        contentType,
        this.storagePolicy.signedUrlTtlSeconds,
      );
      presignedUrls.push(url);
    } else {
      uploadId = await this.storage.initiateMultipartUpload(key, contentType);
      for (let i = 1; i <= totalChunks; i++) {
        const url = await this.storage.getUploadPartPresignedUrl(
          key,
          uploadId,
          i,
          this.storagePolicy.signedUrlTtlSeconds,
        );
        presignedUrls.push(url);
      }
    }

    const session: UploadSession = {
      id: sessionId,
      videoId,
      totalChunks,
      uploadedChunks: 0,
      chunkSize,
      totalSize: size,
      startedAt: new Date(),
      filename,
      uploadId,
      etags: [],
      securityPosture: this.securityPosture,
    };

    this.videos.set(videoId, video);
    this.sessions.set(sessionId, session);
    videoEvents.emitUploadStarted(videoId, filename);

    return { sessionId, videoId, chunkSize, totalChunks, presignedUrls };
  }

  async uploadChunk(sessionId: string, chunkIndex: number, chunk: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');

    const video = this.videos.get(session.videoId);
    if (!video) throw new Error('Video not found');

    const checksumSHA256 = createHash('sha256').update(chunk).digest('base64');

    if (session.totalChunks === 1) {
      await this.storage.upload(
        chunk,
        video.filename,
        video.mimeType || 'application/octet-stream',
        checksumSHA256,
      );
    } else {
      const partNumber = chunkIndex + 1;
      const etag = await this.storage.uploadPart(
        chunk,
        video.filename,
        session.uploadId,
        partNumber,
        checksumSHA256,
      );
      session.etags.push({ PartNumber: partNumber, ETag: etag });
    }

    session.uploadedChunks = chunkIndex + 1;
    const progress = (session.uploadedChunks / session.totalChunks) * 100;
    video.progress = progress;
    video.updatedAt = new Date();
    video.securityPosture = this.securityPosture;
    session.securityPosture = this.securityPosture;

    videoEvents.emitUploadProgress({
      videoId: session.videoId,
      filename: session.filename,
      progress,
      uploadedBytes: Math.min(session.uploadedChunks * session.chunkSize, session.totalSize),
      totalBytes: session.totalSize,
    });
  }

  async completeUpload(
    sessionId: string,
    etags: { PartNumber: number; ETag: string }[] = [],
    thumbnailBase64?: string,
  ): Promise<Video> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');

    const video = this.videos.get(session.videoId);
    if (!video) throw new Error('Video not found');

    const parts = etags.length > 0 ? etags : session.etags;
    const url = session.totalChunks === 1
      ? await this.storage.getSignedUrl(video.filename)
      : await this.storage.completeMultipartUpload(video.filename, session.uploadId, parts);

    video.status = 'processing';
    video.progress = 100;
    video.url = url;
    video.downloadUrl = url;
    video.thumbnailStatus = 'pending';
    video.updatedAt = new Date();
    video.securityPosture = this.securityPosture;
    session.securityPosture = this.securityPosture;

    videoEvents.emitUploadCompleted(session.videoId, video.originalName, video.size, url);
    videoEvents.emitVideoProcessing(session.videoId, 'processing');

    if (thumbnailBase64) {
      try {
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const thumbnailKey = `thumbnails/${video.id}.jpg`;
        const checksum = createHash('sha256').update(buffer).digest('base64');
        const thumbnailUrl = await this.storage.upload(
          buffer,
          thumbnailKey,
          'image/jpeg',
          checksum,
        );
        video.thumbnailUrl = thumbnailUrl;
        video.thumbnailStatus = 'ready';
        videoEvents.emitThumbnailGenerated(video.id, thumbnailUrl, new Date().toISOString());
      } catch (err) {
        console.error('Failed to upload client-provided thumbnail', err);
        this.thumbnailExtractor.extract(video);
      }
    } else {
      // Spawn thumbnail extraction (non-blocking)
      this.thumbnailExtractor.extract(video);
    }

    const readyTimer = setTimeout(() => {
      video.status = 'ready';
      videoEvents.emitVideoReady(session.videoId);
    }, 2000);
    readyTimer.unref?.();

    this.sessions.delete(sessionId);
    return video;
  }

  getVideo(videoId: string): Video | undefined {
    return this.videos.get(videoId);
  }

  getAllVideos(): Video[] {
    return Array.from(this.videos.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async deleteVideo(videoId: string): Promise<void> {
    const video = this.videos.get(videoId);
    if (video) {
      await this.storage.delete(video.filename);
      if (video.thumbnailUrl) {
        try {
          const thumbnailKey = `thumbnails/${video.id}.jpg`;
          await this.storage.delete(thumbnailKey);
        } catch {
          // Thumbnail cleanup is best-effort.
        }
      }
      this.videos.delete(videoId);
    }
  }

  updateVideoTitle(videoId: string, title: string): Video | undefined {
    const video = this.videos.get(videoId);
    if (!video) {
      return undefined;
    }

    video.title = title;
    video.updatedAt = new Date();
    video.securityPosture = this.securityPosture;
    return video;
  }

  updateVideoStatus(videoId: string, status: VideoStatus): void {
    const video = this.videos.get(videoId);
    if (video) {
      video.status = status;
      video.updatedAt = new Date();
    }
  }
}

import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from '@/lib/storage';
import { videoEvents } from '@/lib/VideoEventEmitter';
import { Video, UploadSession, VideoStatus } from '@/types';
import { ThumbnailExtractor } from './ThumbnailExtractor';

const CHUNK_SIZE = 10 * 1024 * 1024;

export class UploadService {
  private storage: IStorageAdapter;
  private videos: Map<string, Video> = new Map();
  private sessions: Map<string, UploadSession> = new Map();
  private thumbnailExtractor: ThumbnailExtractor;

  constructor(storage: IStorageAdapter) {
    this.storage = storage;
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
  ): Promise<{ sessionId: string; videoId: string; chunkSize: number; totalChunks: number }> {
    const videoId = uuidv4();
    const sessionId = uuidv4();
    const totalChunks = Math.ceil(size / CHUNK_SIZE);
    const key = `${videoId}/${filename}`;

    const video: Video = {
      id: videoId,
      filename: key,
      originalName: filename,
      size,
      status: 'uploading',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      mimeType,
    };

    let uploadId = '';
    if (totalChunks > 1) {
      uploadId = await this.storage.initiateMultipartUpload(
        key,
        mimeType || 'application/octet-stream',
      );
    }

    const session: UploadSession = {
      id: sessionId,
      videoId,
      totalChunks,
      uploadedChunks: 0,
      chunkSize: CHUNK_SIZE,
      totalSize: size,
      startedAt: new Date(),
      filename,
      uploadId,
      etags: [],
    };

    this.videos.set(videoId, video);
    this.sessions.set(sessionId, session);
    videoEvents.emitUploadStarted(videoId, filename);

    return { sessionId, videoId, chunkSize: CHUNK_SIZE, totalChunks };
  }

  async uploadChunk(sessionId: string, chunkIndex: number, chunk: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');

    const video = this.videos.get(session.videoId);
    if (!video) throw new Error('Video not found');

    if (session.totalChunks === 1) {
      await this.storage.upload(chunk, video.filename, video.mimeType || 'application/octet-stream');
    } else {
      const partNumber = chunkIndex + 1;
      const etag = await this.storage.uploadPart(chunk, video.filename, session.uploadId, partNumber);
      session.etags.push({ PartNumber: partNumber, ETag: etag });
    }

    session.uploadedChunks = chunkIndex + 1;
    const progress = (session.uploadedChunks / session.totalChunks) * 100;
    video.progress = progress;
    video.updatedAt = new Date();

    videoEvents.emitUploadProgress({
      videoId: session.videoId,
      filename: session.filename,
      progress,
      uploadedBytes: Math.min(session.uploadedChunks * session.chunkSize, session.totalSize),
      totalBytes: session.totalSize,
    });
  }

  async completeUpload(sessionId: string): Promise<Video> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');

    const video = this.videos.get(session.videoId);
    if (!video) throw new Error('Video not found');

    let url: string;
    if (session.totalChunks === 1) {
      url = await this.storage.getSignedUrl(video.filename);
    } else {
      url = await this.storage.completeMultipartUpload(
        video.filename,
        session.uploadId,
        session.etags,
      );
    }

    video.status = 'processing';
    video.progress = 100;
    video.url = url;
    video.thumbnailStatus = 'pending';
    video.updatedAt = new Date();

    videoEvents.emitUploadCompleted(session.videoId, video.originalName, video.size, url);
    videoEvents.emitVideoProcessing(session.videoId, 'processing');

    // Spawn thumbnail extraction (non-blocking)
    this.thumbnailExtractor.extract(video);

    setTimeout(() => {
      video.status = 'ready';
      videoEvents.emitVideoReady(session.videoId);
    }, 2000);

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
      this.videos.delete(videoId);
    }
  }

  updateVideoStatus(videoId: string, status: VideoStatus): void {
    const video = this.videos.get(videoId);
    if (video) {
      video.status = status;
      video.updatedAt = new Date();
    }
  }
}

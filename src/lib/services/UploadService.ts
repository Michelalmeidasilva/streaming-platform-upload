import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from '@/lib/storage';
import { videoEvents } from '@/lib/VideoEventEmitter';
import { Video, UploadSession, VideoStatus } from '@/types';

const CHUNK_SIZE = 10 * 1024 * 1024;

export class UploadService {
  private storage: IStorageAdapter;
  private videos: Map<string, Video> = new Map();
  private sessions: Map<string, UploadSession> = new Map();

  constructor(storage: IStorageAdapter) {
    this.storage = storage;
  }

  async initiateUpload(filename: string, size: number, mimeType?: string): Promise<{ sessionId: string; videoId: string; chunkSize: number }> {
    const videoId = uuidv4();
    const sessionId = uuidv4();
    const totalChunks = Math.ceil(size / CHUNK_SIZE);

    const video: Video = {
      id: videoId,
      filename: `${videoId}/${filename}`,
      originalName: filename,
      size,
      status: 'uploading',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      mimeType,
    };

    const session: UploadSession = {
      id: sessionId,
      videoId,
      totalChunks,
      uploadedChunks: 0,
      chunkSize: CHUNK_SIZE,
      totalSize: size,
      startedAt: new Date(),
      filename,
    };

    this.videos.set(videoId, video);
    this.sessions.set(sessionId, session);

    videoEvents.emitUploadStarted(videoId, filename);

    return { sessionId, videoId, chunkSize: CHUNK_SIZE };
  }

  async uploadChunk(sessionId: string, chunkIndex: number, chunk: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    const key = `${session.videoId}/chunk-${chunkIndex}`;
    await this.storage.uploadChunk(chunk, key, chunkIndex + 1);

    session.uploadedChunks = chunkIndex + 1;
    const progress = (session.uploadedChunks / session.totalChunks) * 100;

    const video = this.videos.get(session.videoId);
    if (video) {
      video.progress = progress;
      video.updatedAt = new Date();
    }

    videoEvents.emitUploadProgress({
      videoId: session.videoId,
      filename: session.filename,
      progress,
      uploadedBytes: session.uploadedChunks * session.chunkSize,
      totalBytes: session.totalSize,
    });
  }

  async completeUpload(sessionId: string): Promise<Video> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    const video = this.videos.get(session.videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const url = await this.storage.getSignedUrl(video.filename);
    
    video.status = 'processing';
    video.progress = 100;
    video.url = url;
    video.updatedAt = new Date();

    videoEvents.emitUploadCompleted(session.videoId, video.originalName, video.size, url);
    videoEvents.emitVideoProcessing(session.videoId, 'processing');

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
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
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

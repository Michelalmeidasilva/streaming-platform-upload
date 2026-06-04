import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from '@/lib/storage';
import type { UploadStateStore } from '@/lib/persistence/IngestUploadStateClient';
import { videoEvents } from '@/lib/VideoEventEmitter';
import {
  PersistedUploadState,
  RecoveryPolicy,
  SecurityPosture,
  StorageSecurityPolicy,
  Video,
  UploadSession,
  VideoStatus,
} from '@/types';
import {
  EventType,
  EventData,
  RawVideoParams,
  SubtitleRef,
  VideoThumbnailGeneratedEvent,
  VideoThumbnailFallbackEvent,
} from '@/lib/events';

// SubtitleInput is the per-track metadata the client supplies at initiate. The
// .srt bytes are uploaded separately to the presigned URL returned below.
export interface SubtitleInput {
  language?: string;
  label?: string;
}

// SubtitleUpload tells the client where to PUT each .srt and the objectKey the
// pipeline will read it from.
export interface SubtitleUpload {
  objectKey: string;
  url: string;
  language: string;
  label?: string;
}
import { ThumbnailExtractor } from './ThumbnailExtractor';
import { getRecoveryPolicy } from '@/lib/security/recovery-policy';
import { resolveStoragePolicy } from '@/lib/security/storage-policy';

const MIN_MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = MIN_MULTIPART_CHUNK_SIZE;

function resolveChunkSize() {
  const parsed = Number.parseInt(process.env.UPLOAD_CHUNK_SIZE_BYTES || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CHUNK_SIZE;
  }

  return Math.max(parsed, MIN_MULTIPART_CHUNK_SIZE);
}

function rawUploadPrefixEnabled() {
  return process.env.UPLOAD_RAW_PREFIX_ENABLED === 'true';
}

// sanitizeLanguage normalizes a subtitle language into a filename-safe token,
// mirroring the transcoder's SanitizeLanguage so playlist paths line up.
function sanitizeLanguage(language: string | undefined, fallback: string): string {
  const token = (language || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return token || fallback;
}

function buildSubtitleKey(videoId: string, language: string): string {
  return `subtitles/${videoId}/${language}.srt`;
}

function buildObjectKey(videoId: string, filename: string) {
  const normalizedFilename = filename.replace(/^\/+/, '');
  if (rawUploadPrefixEnabled()) {
    return `raw/${videoId}/${normalizedFilename}`;
  }
  return `${videoId}/${normalizedFilename}`;
}

export class UploadService {
  private readonly storage: IStorageAdapter;
  private readonly stateStore: UploadStateStore;
  private readonly thumbnailExtractor: ThumbnailExtractor;
  private readonly storagePolicy: StorageSecurityPolicy;
  private readonly recoveryPolicy: RecoveryPolicy;
  private readonly securityPosture: SecurityPosture;

  constructor(
    storage: IStorageAdapter,
    config: Partial<SecurityPosture> & { stateStore: UploadStateStore },
  ) {
    this.storage = storage;
    this.stateStore = config.stateStore;
    this.storagePolicy = config.storage || resolveStoragePolicy();
    this.recoveryPolicy = config.recovery || getRecoveryPolicy();
    this.securityPosture = {
      storage: this.storagePolicy,
      recovery: this.recoveryPolicy,
    };
    this.thumbnailExtractor = new ThumbnailExtractor(storage, videoEvents);

    videoEvents.on('video.thumbnail.generated' as EventType, (data: EventData) => {
      const event = data as VideoThumbnailGeneratedEvent;
      void this.persistVideoMutation(event.videoId, (video) => {
        video.thumbnailUrl = event.thumbnailUrl;
        video.thumbnailStatus = 'ready';
        video.updatedAt = new Date();
      });
    });

    videoEvents.on('video.thumbnail.fallback' as EventType, (data: EventData) => {
      const event = data as VideoThumbnailFallbackEvent;
      void this.persistVideoMutation(event.videoId, (video) => {
        video.thumbnailUrl = event.thumbnailUrl;
        video.thumbnailStatus = 'failed';
        video.updatedAt = new Date();
      });
    });
  }

  private async persistVideoMutation(videoId: string, mutate: (video: Video) => void) {
    const video = await this.stateStore.getVideo(videoId);
    if (!video) {
      return;
    }

    mutate(video);
    await this.stateStore.saveVideo(video);
  }

  private async getStateOrThrow(sessionId: string): Promise<PersistedUploadState> {
    const state = await this.stateStore.getState(sessionId);
    if (!state) {
      throw new Error('Invalid session');
    }
    return state;
  }

  async initiateUpload(
    filename: string,
    size: number,
    mimeType?: string,
    rawVideo?: RawVideoParams,
    subtitles?: SubtitleInput[],
  ): Promise<{
    sessionId: string;
    videoId: string;
    chunkSize: number;
    totalChunks: number;
    presignedUrls: string[];
    subtitleUploads: SubtitleUpload[];
  }> {
    const chunkSize = resolveChunkSize();
    const videoId = uuidv4();
    const sessionId = uuidv4();
    const totalChunks = Math.ceil(size / chunkSize);
    const key = buildObjectKey(videoId, filename);
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
      const partUrls = await Promise.all(
        Array.from({ length: totalChunks }, (_, i) =>
          this.storage.getUploadPartPresignedUrl(key, uploadId, i + 1, this.storagePolicy.signedUrlTtlSeconds),
        ),
      );
      presignedUrls.push(...partUrls);
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

    // Sidecar subtitles: presign a PUT per track and forward the planned object
    // keys on upload.started so the gateway can attach them to the transcode job.
    const subtitleUploads: SubtitleUpload[] = [];
    const subtitleRefs: SubtitleRef[] = [];
    const usedLanguages = new Set<string>();
    for (let i = 0; i < (subtitles?.length ?? 0); i++) {
      const sub = subtitles![i];
      let language = sanitizeLanguage(sub.language, `sub-${i + 1}`);
      while (usedLanguages.has(language)) language = `${language}-${i + 1}`;
      usedLanguages.add(language);
      const objectKey = buildSubtitleKey(videoId, language);
      const url = await this.storage.getUploadPresignedUrl(
        objectKey,
        'text/plain',
        this.storagePolicy.signedUrlTtlSeconds,
      );
      subtitleUploads.push({ objectKey, url, language, label: sub.label });
      subtitleRefs.push({ objectKey, language, label: sub.label });
    }

    await this.stateStore.saveState({ session, video });
    videoEvents.emitUploadStarted(videoId, filename, rawVideo, subtitleRefs.length ? subtitleRefs : undefined);

    return { sessionId, videoId, chunkSize, totalChunks, presignedUrls, subtitleUploads };
  }

  async uploadChunk(sessionId: string, chunkIndex: number, chunk: Buffer): Promise<void> {
    const { session, video } = await this.getStateOrThrow(sessionId);

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
    await this.stateStore.saveState({ session, video });

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
    const { session, video } = await this.getStateOrThrow(sessionId);

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
    await this.stateStore.saveVideo(video);

    videoEvents.emitUploadCompleted(session.videoId, video.filename, video.size, url, {
      originalName: video.originalName,
      objectKey: video.filename,
      provider: process.env.STORAGE_PROVIDER || 'minio',
      bucket: process.env.STORAGE_BUCKET || 'videos',
    });
    videoEvents.emitVideoProcessing(session.videoId, 'processing');

    if (thumbnailBase64) {
      try {
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const thumbnailKey = `thumbnails/${video.id}.jpg`;
        const checksum = createHash('sha256').update(buffer).digest('base64');
        await this.storage.upload(
          buffer,
          thumbnailKey,
          'image/jpeg',
          checksum,
        );
        // Browser-reachable, unsigned URL — not the internal-host presigned URL
        // returned by upload(), which the browser cannot resolve.
        const thumbnailUrl = await this.storage.getPublicUrl(thumbnailKey);
        video.thumbnailUrl = thumbnailUrl;
        video.thumbnailStatus = 'ready';
        videoEvents.emitThumbnailGenerated(video.id, thumbnailUrl, new Date().toISOString());
        await this.stateStore.saveVideo(video);
      } catch (err) {
        console.error('Failed to upload client-provided thumbnail', err);
        this.thumbnailExtractor.extract(video);
      }
    } else {
      // Spawn thumbnail extraction (non-blocking)
      this.thumbnailExtractor.extract(video);
    }

    await this.stateStore.deleteSession(sessionId);
    return video;
  }

  async getVideo(videoId: string): Promise<Video | undefined> {
    return (await this.stateStore.getVideo(videoId)) || undefined;
  }

  async getAllVideos(query?: string): Promise<Video[]> {
    return this.stateStore.listVideos(query);
  }

  async deleteVideo(videoId: string): Promise<void> {
    const video = await this.stateStore.getVideo(videoId);
    if (video) {
      if (video.thumbnailUrl) {
        try {
          const thumbnailKey = `thumbnails/${video.id}.jpg`;
          await this.storage.delete(thumbnailKey);
        } catch {
          // Thumbnail cleanup is best-effort.
        }
      }
      try {
        await this.storage.delete(video.filename);
      } catch {
        // Primary object cleanup is best-effort for idempotent deletes.
      }
      await this.stateStore.deleteVideo(videoId);
    }
  }

  async updateVideoTitle(videoId: string, title: string): Promise<Video | undefined> {
    const updated = await this.stateStore.updateVideo(videoId, {
      title,
      updatedAt: new Date(),
    });
    return updated || undefined;
  }

  async updateVideoStatus(videoId: string, status: VideoStatus): Promise<void> {
    await this.stateStore.updateVideo(videoId, { status, updatedAt: new Date() });
  }
}

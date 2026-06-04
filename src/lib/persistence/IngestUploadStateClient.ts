import type { PersistedUploadState, UploadSession, Video, VideoStatus } from '@/types';

export interface UploadStateStore {
  saveState(state: PersistedUploadState): Promise<void>;
  getState(sessionId: string): Promise<PersistedUploadState | null>;
  deleteSession(sessionId: string): Promise<void>;
  saveVideo(video: Video): Promise<void>;
  getVideo(videoId: string): Promise<Video | null>;
  listVideos(query?: string): Promise<Video[]>;
  updateVideo(videoId: string, patch: Partial<Video>): Promise<Video | null>;
  deleteVideo(videoId: string): Promise<void>;
}

function normalizeBaseUrl(raw?: string) {
  const fallback = 'http://localhost:8080/api/v1';
  return (raw || fallback).replace(/\/+$/, '');
}

type DateInput = string | Date | undefined;

function toDate(value: DateInput) {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date();
}

function asString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function mapVideo(video: Record<string, unknown>): Video {
  return {
    id: asString(video.id),
    filename: asString(video.filename),
    originalName: asString(video.originalName),
    title: asString(video.title || video.originalName),
    size: Number(video.size || 0),
    status: (video.status as VideoStatus) || 'uploading',
    progress: Number(video.progress || 0),
    createdAt: toDate(video.createdAt as DateInput),
    updatedAt: toDate(video.updatedAt as DateInput),
    url: typeof video.url === 'string' ? video.url : undefined,
    downloadUrl: typeof video.downloadUrl === 'string' ? video.downloadUrl : undefined,
    thumbnailUrl: typeof video.thumbnailUrl === 'string' ? video.thumbnailUrl : undefined,
    thumbnailStatus: typeof video.thumbnailStatus === 'string' ? video.thumbnailStatus as Video['thumbnailStatus'] : undefined,
    mimeType: typeof video.mimeType === 'string' ? video.mimeType : undefined,
    processingStatus: typeof video.processingStatus === 'string' ? video.processingStatus as Video['processingStatus'] : undefined,
    storageConfirmedAt: typeof video.storageConfirmedAt === 'string' ? video.storageConfirmedAt : undefined,
    source: typeof video.source === 'object' && video.source !== null ? video.source as Video['source'] : undefined,
    mediaInfo: typeof video.mediaInfo === 'object' && video.mediaInfo !== null ? video.mediaInfo as Video['mediaInfo'] : undefined,
    transcode: typeof video.transcode === 'object' && video.transcode !== null ? video.transcode as Video['transcode'] : undefined,
    playback: typeof video.playback === 'object' && video.playback !== null ? video.playback as Video['playback'] : undefined,
    metrics: typeof video.metrics === 'object' && video.metrics !== null ? video.metrics as Video['metrics'] : undefined,
  };
}

function mapSession(session: Record<string, unknown>): UploadSession {
  return {
    id: asString(session.id),
    videoId: asString(session.videoId),
    totalChunks: Number(session.totalChunks || 0),
    uploadedChunks: Number(session.uploadedChunks || 0),
    chunkSize: Number(session.chunkSize || 0),
    totalSize: Number(session.totalSize || 0),
    startedAt: toDate(session.startedAt as DateInput),
    filename: asString(session.filename),
    uploadId: asString(session.uploadId),
    etags: Array.isArray(session.etags)
      ? session.etags.map((etag) => ({
          PartNumber: Number((etag as { PartNumber?: unknown }).PartNumber || 0),
          ETag: asString((etag as { ETag?: unknown }).ETag),
        }))
      : [],
  };
}

async function parseJson(response: Response) {
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export class IngestUploadStateClient implements UploadStateStore {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl || process.env.INGEST_PERSISTENCE_BASE_URL || process.env.EVENT_GATEWAY_URL);
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      cache: 'no-store',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        if (body?.error) {
          message = String(body.error);
        }
      } catch {
        // ignore parse failures
      }
      throw new Error(message);
    }

    return parseJson(response);
  }

  async saveState(state: PersistedUploadState): Promise<void> {
    await this.request(`/upload-state/sessions/${encodeURIComponent(state.session.id)}`, {
      method: 'PUT',
      body: JSON.stringify(state),
    });
  }

  async getState(sessionId: string): Promise<PersistedUploadState | null> {
    const body = await this.request(`/upload-state/sessions/${encodeURIComponent(sessionId)}`);
    if (!body) {
      return null;
    }

    return {
      session: mapSession((body as { session: Record<string, unknown> }).session),
      video: mapVideo((body as { video: Record<string, unknown> }).video),
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/upload-state/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }

  async saveVideo(video: Video): Promise<void> {
    await this.request(`/upload-state/videos/${encodeURIComponent(video.id)}`, {
      method: 'PUT',
      body: JSON.stringify(video),
    });
  }

  async getVideo(videoId: string): Promise<Video | null> {
    const body = await this.request(`/upload-state/videos/${encodeURIComponent(videoId)}`);
    if (!body) {
      return null;
    }

    return mapVideo((body as { video: Record<string, unknown> }).video);
  }

  async listVideos(query?: string): Promise<Video[]> {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    const body = await this.request(`/upload-state/videos${suffix}`);
    return Array.isArray((body as { videos?: Record<string, unknown>[] } | null)?.videos)
      ? (body as { videos: Record<string, unknown>[] }).videos.map(mapVideo)
      : [];
  }

  async updateVideo(videoId: string, patch: Partial<Video>): Promise<Video | null> {
    const body = await this.request(`/upload-state/videos/${encodeURIComponent(videoId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!body) {
      return null;
    }

    return mapVideo((body as { video: Record<string, unknown> }).video);
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.request(`/upload-state/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
  }
}

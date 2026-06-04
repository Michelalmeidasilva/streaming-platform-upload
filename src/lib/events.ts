export type EventType =
  | 'upload.started'
  | 'upload.progress'
  | 'upload.completed'
  | 'upload.failed'
  | 'video.processing'
  | 'video.ready'
  | 'video.transcoded'
  | 'video.error'
  | 'video.thumbnail.generated'
  | 'video.thumbnail.fallback';

// RawVideoParams describes a headerless raw upload (.yuv). ffprobe cannot infer
// geometry from the bytes, so the operator supplies it and it travels with the
// upload.started event to the gateway and on to the transcoder.
export interface RawVideoParams {
  width: number;
  height: number;
  fps: number;
  pixelFormat?: string;
}

// SubtitleRef points at a sidecar subtitle (.srt) uploaded with the video. The
// objectKey is the storage location the gateway forwards to the transcoder,
// which converts it to WebVTT.
export interface SubtitleRef {
  objectKey: string;
  language?: string;
  label?: string;
}

export interface UploadStartedEvent {
  videoId: string;
  filename: string;
  rawVideo?: RawVideoParams;
  subtitles?: SubtitleRef[];
}

export interface UploadProgressEvent {
  videoId: string;
  filename: string;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed?: number;
}

export interface UploadCompletedEvent {
  videoId: string;
  filename: string;
  originalName?: string;
  objectKey?: string;
  provider?: string;
  bucket?: string;
  size: number;
  url: string;
}

export interface UploadFailedEvent {
  videoId: string;
  filename: string;
  error: string;
}

export interface VideoProcessingEvent {
  videoId: string;
  status: 'processing' | 'ready' | 'error';
}

export interface VideoThumbnailGeneratedEvent {
  videoId: string;
  thumbnailUrl: string;
  extractedAt: string;
}

export interface VideoThumbnailFallbackEvent {
  videoId: string;
  thumbnailUrl: string;
  reason: 'ffmpeg_timeout' | 'unsupported_codec' | 'corrupted_file' | 'network_error' | 'storage_error';
  fallbackAt: string;
}

export type EventData =
  | UploadStartedEvent
  | UploadProgressEvent
  | UploadCompletedEvent
  | UploadFailedEvent
  | VideoProcessingEvent
  | VideoThumbnailGeneratedEvent
  | VideoThumbnailFallbackEvent;

export interface VideoEvents {
  on(event: 'upload.started', handler: (data: UploadStartedEvent) => void): void;
  on(event: 'upload.progress', handler: (data: UploadProgressEvent) => void): void;
  on(event: 'upload.completed', handler: (data: UploadCompletedEvent) => void): void;
  on(event: 'upload.failed', handler: (data: UploadFailedEvent) => void): void;
  on(event: 'video.processing', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.ready', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.transcoded', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.error', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.thumbnail.generated', handler: (data: VideoThumbnailGeneratedEvent) => void): void;
  on(event: 'video.thumbnail.fallback', handler: (data: VideoThumbnailFallbackEvent) => void): void;

  emit(event: 'upload.started', data: UploadStartedEvent): void;
  emit(event: 'upload.progress', data: UploadProgressEvent): void;
  emit(event: 'upload.completed', data: UploadCompletedEvent): void;
  emit(event: 'upload.failed', data: UploadFailedEvent): void;
  emit(event: 'video.processing', data: VideoProcessingEvent): void;
  emit(event: 'video.ready', data: VideoProcessingEvent): void;
  emit(event: 'video.transcoded', data: VideoProcessingEvent): void;
  emit(event: 'video.error', data: VideoProcessingEvent): void;
  emit(event: 'video.thumbnail.generated', data: VideoThumbnailGeneratedEvent): void;
  emit(event: 'video.thumbnail.fallback', data: VideoThumbnailFallbackEvent): void;

  off(event: EventType, handler: (data: EventData) => void): void;
}

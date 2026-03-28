export type EventType =
  | 'upload.started'
  | 'upload.progress'
  | 'upload.completed'
  | 'upload.failed'
  | 'video.processing'
  | 'video.ready'
  | 'video.transcoded'
  | 'video.error';

export interface UploadStartedEvent {
  videoId: string;
  filename: string;
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

export type EventData =
  | UploadStartedEvent
  | UploadProgressEvent
  | UploadCompletedEvent
  | UploadFailedEvent
  | VideoProcessingEvent;

export interface VideoEvents {
  on(event: 'upload.started', handler: (data: { videoId: string; filename: string }) => void): void;
  on(event: 'upload.progress', handler: (data: UploadProgressEvent) => void): void;
  on(event: 'upload.completed', handler: (data: UploadCompletedEvent) => void): void;
  on(event: 'upload.failed', handler: (data: UploadFailedEvent) => void): void;
  on(event: 'video.processing', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.ready', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.transcoded', handler: (data: VideoProcessingEvent) => void): void;
  on(event: 'video.error', handler: (data: VideoProcessingEvent) => void): void;

  emit(event: 'upload.started', data: { videoId: string; filename: string }): void;
  emit(event: 'upload.progress', data: UploadProgressEvent): void;
  emit(event: 'upload.completed', data: UploadCompletedEvent): void;
  emit(event: 'upload.failed', data: UploadFailedEvent): void;
  emit(event: 'video.processing', data: VideoProcessingEvent): void;
  emit(event: 'video.ready', data: VideoProcessingEvent): void;
  emit(event: 'video.transcoded', data: VideoProcessingEvent): void;
  emit(event: 'video.error', data: VideoProcessingEvent): void;

  off(event: EventType, handler: (data: EventData) => void): void;
}

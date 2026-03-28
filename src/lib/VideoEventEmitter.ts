import { EventEmitter as NodeEventEmitter } from 'events';
import {
  EventType,
  EventData,
  UploadProgressEvent,
  UploadCompletedEvent,
  UploadFailedEvent,
  VideoProcessingEvent,
} from './events';

export class VideoEventEmitter extends NodeEventEmitter {
  private eventHistory: Array<{ type: EventType; data: EventData; timestamp: Date }> = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emit(event: EventType, data: EventData): boolean {
    this.addToHistory(event, data);
    return super.emit(event, data);
  }

  on(event: EventType, handler: (data: EventData) => void): this {
    return super.on(event, handler);
  }

  off(event: EventType, handler: (data: EventData) => void): this {
    return super.off(event, handler);
  }

  private addToHistory(type: EventType, data: EventData): void {
    this.eventHistory.push({
      type,
      data,
      timestamp: new Date(),
    });

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getHistory(): Array<{ type: EventType; data: EventData; timestamp: Date }> {
    return [...this.eventHistory];
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  emitUploadStarted(videoId: string, filename: string): void {
    this.emit('upload.started', { videoId, filename });
  }

  emitUploadProgress(data: Omit<UploadProgressEvent, 'videoId' | 'filename'> & { videoId: string; filename: string }): void {
    this.emit('upload.progress', data);
  }

  emitUploadCompleted(videoId: string, filename: string, size: number, url: string): void {
    this.emit('upload.completed', { videoId, filename, size, url });
  }

  emitUploadFailed(videoId: string, filename: string, error: string): void {
    this.emit('upload.failed', { videoId, filename, error });
  }

  emitVideoProcessing(videoId: string, status: 'processing' | 'ready' | 'error'): void {
    this.emit('video.processing', { videoId, status });
  }

  emitVideoReady(videoId: string): void {
    this.emit('video.ready', { videoId, status: 'ready' });
  }

  emitVideoError(videoId: string): void {
    this.emit('video.error', { videoId, status: 'error' });
  }
}

export const videoEvents = new VideoEventEmitter();

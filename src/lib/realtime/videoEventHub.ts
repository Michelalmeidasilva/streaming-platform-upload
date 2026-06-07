import type { Video } from '@/types';
import { uploadService } from '@/lib/api/uploadService';
import { deriveThumbnailUrl as defaultDeriveThumbnailUrl } from '@/app/api/videos/thumbnail';

export interface VideoUpdatePayload {
  id: string;
  status: string;
  processingStatus: string | null;
  thumbnailStatus: string | null;
  storageConfirmedAt: string | null;
  thumbnailUrl: string | null;
}

export type VideoFetcher = (videoId: string) => Promise<Video | undefined>;
export type ThumbnailDeriver = (
  video: Pick<Video, 'id' | 'thumbnailUrl' | 'thumbnailStatus'>,
) => Promise<string | null>;
export type VideoUpdateHandler = (payload: VideoUpdatePayload) => void;

export interface VideoEventHubOptions {
  fetchVideo: VideoFetcher;
  deriveThumbnailUrl: ThumbnailDeriver;
  debounceMs?: number;
}

export class VideoEventHub {
  private readonly handlers = new Set<VideoUpdateHandler>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly fetchVideo: VideoFetcher;
  private readonly deriveThumbnailUrl: ThumbnailDeriver;
  private readonly debounceMs: number;

  constructor(options: VideoEventHubOptions) {
    this.fetchVideo = options.fetchVideo;
    this.deriveThumbnailUrl = options.deriveThumbnailUrl;
    this.debounceMs = options.debounceMs ?? 250;
  }

  subscribe(handler: VideoUpdateHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  publish(videoId: string): void {
    const existing = this.timers.get(videoId);
    if (existing) {
      clearTimeout(existing);
    }
    this.timers.set(
      videoId,
      setTimeout(() => {
        this.timers.delete(videoId);
        void this.flush(videoId);
      }, this.debounceMs),
    );
  }

  private async flush(videoId: string): Promise<void> {
    let video: Video | undefined;
    try {
      video = await this.fetchVideo(videoId);
    } catch {
      return; // best-effort; next event or snapshot-on-connect recovers
    }
    if (!video) {
      return;
    }
    let thumbnailUrl: string | null = null;
    try {
      thumbnailUrl = await this.deriveThumbnailUrl(video);
    } catch {
      // thumbnail derivation is non-fatal; still broadcast the status update
    }
    const payload: VideoUpdatePayload = {
      id: video.id,
      status: video.status,
      processingStatus: video.processingStatus ?? null,
      thumbnailStatus: video.thumbnailStatus ?? null,
      storageConfirmedAt: video.storageConfirmedAt ?? null,
      thumbnailUrl,
    };
    for (const handler of Array.from(this.handlers)) {
      try {
        handler(payload);
      } catch {
        // a failing subscriber must not break the broadcast
      }
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __videoEventHub__: VideoEventHub | undefined;
}

export function getVideoEventHub(): VideoEventHub {
  if (!globalThis.__videoEventHub__) {
    globalThis.__videoEventHub__ = new VideoEventHub({
      fetchVideo: (id) => uploadService.getVideo(id),
      deriveThumbnailUrl: defaultDeriveThumbnailUrl,
    });
  }
  return globalThis.__videoEventHub__;
}

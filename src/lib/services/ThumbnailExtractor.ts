import { execFile } from 'child_process';
import { promisify } from 'util';
import { unlink as unlinkFile } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { IStorageAdapter } from '@/lib/storage';
import { VideoEventEmitter } from '@/lib/VideoEventEmitter';
import { Video } from '@/types';
import { FallbackGenerator } from '@/lib/images/FallbackGenerator';

const execFileAsync = promisify(execFile);
const unlinkAsync = promisify(unlinkFile);

export class ThumbnailExtractor {
  private extractionInProgress: Set<string> = new Set();
  private readonly EXTRACTION_TIMEOUT_MS = 5000;
  private readonly FALLBACK_GENERATOR: FallbackGenerator;

  constructor(
    private storageAdapter: IStorageAdapter,
    private eventEmitter: VideoEventEmitter,
  ) {
    this.FALLBACK_GENERATOR = new FallbackGenerator();
  }

  async extract(video: Video): Promise<void> {
    setImmediate(async () => {
      try {
        await this.performExtraction(video);
      } catch (error) {
        console.error('Unexpected error in thumbnail extraction', {
          videoId: video.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  private async performExtraction(video: Video): Promise<void> {
    if (this.extractionInProgress.has(video.id)) {
      console.info('Thumbnail extraction already in progress', { videoId: video.id });
      return;
    }

    this.extractionInProgress.add(video.id);

    try {
      const startTime = Date.now();
      const presignedUrl = await this.storageAdapter.getSignedUrl(video.filename);
      const frameBuffer = await this.extractFrameFromUrl(presignedUrl);

      if (frameBuffer) {
        const thumbnailKey = `thumbnails/${video.id}.jpg`;
        await this.storageAdapter.upload(frameBuffer, thumbnailKey, 'image/jpeg');
        const thumbnailUrl = await this.storageAdapter.getPublicUrl(thumbnailKey);

        const duration = Date.now() - startTime;
        console.info('Thumbnail extracted successfully', {
          videoId: video.id,
          durationMs: duration,
          size: frameBuffer.length,
        });

        this.eventEmitter.emitThumbnailGenerated(
          video.id,
          thumbnailUrl,
          new Date().toISOString(),
        );
      } else {
        await this.useFallbackThumbnail(video, 'ffmpeg_timeout');
      }
    } catch (error) {
      console.warn('Thumbnail extraction failed, using fallback', {
        videoId: video.id,
        error: error instanceof Error ? error.message : String(error),
      });

      const reason = this.getErrorReason(error);
      await this.useFallbackThumbnail(video, reason);
    } finally {
      this.extractionInProgress.delete(video.id);
    }
  }

  async extractFrameFromUrl(presignedUrl: string): Promise<Buffer | undefined> {
    const outputPath = join(tmpdir(), `thumbnail-${uuid()}.jpg`);

    try {
      await Promise.race([
        this.runFfmpeg(presignedUrl, outputPath),
        this.timeout(this.EXTRACTION_TIMEOUT_MS),
      ]);

      const fs = await import('fs');
      const buffer = await fs.promises.readFile(outputPath);
      return buffer;
    } catch (error) {
      console.warn('Frame extraction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    } finally {
      try {
        await unlinkAsync(outputPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async runFfmpeg(inputUrl: string, outputPath: string): Promise<void> {
    const args = [
      '-i',
      inputUrl,
      '-ss',
      '2',
      '-vf',
      'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
      '-f',
      'image2',
      '-vframes',
      '1',
      '-q:v',
      '5',
      '-y',
      outputPath,
    ];

    try {
      await execFileAsync('ffmpeg', args, {
        timeout: this.EXTRACTION_TIMEOUT_MS + 1000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      throw new Error(
        `FFmpeg execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async generateFallbackImage(video: Video): Promise<Buffer> {
    return this.FALLBACK_GENERATOR.generateFallback(video);
  }

  private async useFallbackThumbnail(
    video: Video,
    reason: 'ffmpeg_timeout' | 'unsupported_codec' | 'corrupted_file' | 'network_error' | 'storage_error',
  ): Promise<void> {
    try {
      const fallbackBuffer = await this.generateFallbackImage(video);
      const fallbackKey = `thumbnails/${video.id}-fallback.jpg`;
      await this.storageAdapter.upload(fallbackBuffer, fallbackKey, 'image/jpeg');
      const fallbackUrl = await this.storageAdapter.getPublicUrl(fallbackKey);

      console.info('Using fallback thumbnail', {
        videoId: video.id,
        reason,
        size: fallbackBuffer.length,
      });

      this.eventEmitter.emitThumbnailFallback(
        video.id,
        fallbackUrl,
        reason,
        new Date().toISOString(),
      );
    } catch (error) {
      console.error('Failed to generate fallback thumbnail', {
        videoId: video.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getErrorReason(
    error: unknown,
  ): 'ffmpeg_timeout' | 'unsupported_codec' | 'corrupted_file' | 'network_error' | 'storage_error' {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error);

    if (message.includes('timeout')) return 'ffmpeg_timeout';
    if (message.includes('codec') || message.includes('unsupported')) return 'unsupported_codec';
    if (message.includes('corrupt') || message.includes('invalid')) return 'corrupted_file';
    if (message.includes('network') || message.includes('econnrefused')) return 'network_error';
    if (message.includes('storage') || message.includes('upload')) return 'storage_error';

    return 'ffmpeg_timeout';
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      timer.unref?.();
    });
  }
}

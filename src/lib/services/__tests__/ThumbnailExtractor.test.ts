import { ThumbnailExtractor } from '@/lib/services/ThumbnailExtractor';
import { IStorageAdapter } from '@/lib/storage';
import { Video } from '@/types';
import { VideoEventEmitter } from '@/lib/VideoEventEmitter';

class MockStorageAdapter implements IStorageAdapter {
  async upload(_file: Buffer, key: string, _contentType: string, _checksumSHA256?: string) {
    return `s3://bucket/${key}`;
  }

  async getUploadPresignedUrl(key: string, _contentType: string, _expiresIn?: number) {
    return `https://mock-storage.example.com/${key}?signature=...`;
  }

  async initiateMultipartUpload(_key: string, _contentType: string) {
    return 'upload-id-123';
  }

  async uploadPart(_chunk: Buffer, _key: string, _uploadId: string, _partNumber: number, _checksumSHA256?: string) {
    return 'etag-123';
  }

  async getUploadPartPresignedUrl(key: string, _uploadId: string, partNumber: number, _expiresIn?: number) {
    return `https://mock-storage.example.com/${key}?partNumber=${partNumber}&signature=...`;
  }

  async completeMultipartUpload(_key: string, _uploadId: string, _parts: { PartNumber: number; ETag: string }[]) {
    return 'https://mock-storage.example.com/video';
  }

  async delete(_key: string) {
    // No return value (Promise<void>)
  }

  async getSignedUrl(key: string, _expiresIn?: number) {
    return `https://mock-storage.example.com/${key}?signature=...`;
  }

  async getPublicUrl(key: string) {
    return `https://cdn.example.com/${key}`;
  }

  async exists(_key: string) {
    return true;
  }

  async listObjects(_prefix?: string) {
    return [];
  }
}

describe('ThumbnailExtractor', () => {
  let extractor: ThumbnailExtractor;
  let storageAdapter: MockStorageAdapter;
  let eventEmitter: VideoEventEmitter;

  beforeEach(() => {
    storageAdapter = new MockStorageAdapter();
    eventEmitter = new VideoEventEmitter();
    extractor = new ThumbnailExtractor(storageAdapter, eventEmitter);
  });

  describe('extract', () => {
    it('should return immediately without blocking', async () => {
      const video: Video = {
        id: 'test-video-123',
        filename: 'sample.mp4',
        originalName: 'Sample.mp4',
        title: 'Sample Video',
        size: 1000000,
        status: 'uploading',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const startTime = Date.now();
      await extractor.extract(video);
      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeLessThan(100);
    });

    it('should not extract the same video twice concurrently', async () => {
      const video: Video = {
        id: 'test-video-concurrent',
        filename: 'sample.mp4',
        originalName: 'Sample.mp4',
        title: 'Sample Video',
        size: 1000000,
        status: 'uploading',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let emissionCount = 0;
      eventEmitter.on('video.thumbnail.generated', () => {
        emissionCount++;
      });
      eventEmitter.on('video.thumbnail.fallback', () => {
        emissionCount++;
      });

      await extractor.extract(video);
      await extractor.extract(video);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(emissionCount).toBeLessThanOrEqual(1);
    });
  });

  describe('performExtraction', () => {
    const video: Video = {
      id: 'test-video-456',
      filename: 'sample.mp4',
      originalName: 'Sample.mp4',
      title: 'Sample Video',
      size: 1000000,
      status: 'uploading',
      progress: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should emit video.thumbnail.generated on success', async () => {
      const successVideo = { ...video, id: 'test-success' };
      const frameBuffer = Buffer.from('fake-frame');
      jest.spyOn(extractor, 'extractFrameFromUrl').mockResolvedValue(frameBuffer);
      jest.spyOn(storageAdapter, 'upload').mockResolvedValue('s3://bucket/thumbnails/test-success.jpg');
      // The emitted URL must be the browser-facing public URL, not upload()'s return.
      const getPublicUrlSpy = jest
        .spyOn(storageAdapter, 'getPublicUrl')
        .mockResolvedValue('https://cdn.example.com/thumbnails/test-success.jpg');
      const emitSpy = jest.spyOn(eventEmitter, 'emitThumbnailGenerated');

      const completion = new Promise<void>(resolve => {
        eventEmitter.once('video.thumbnail.generated', () => resolve());
      });

      await extractor.extract(successVideo);
      await completion;

      expect(getPublicUrlSpy).toHaveBeenCalledWith('thumbnails/test-success.jpg');
      expect(emitSpy).toHaveBeenCalledWith(
        successVideo.id,
        'https://cdn.example.com/thumbnails/test-success.jpg',
        expect.any(String),
      );
    });

    it('should emit video.thumbnail.fallback when frame extraction returns undefined', async () => {
      const timeoutVideo = { ...video, id: 'test-timeout' };
      jest.spyOn(extractor, 'extractFrameFromUrl').mockResolvedValue(undefined);
      const emitSpy = jest.spyOn(eventEmitter, 'emitThumbnailFallback');

      const completion = new Promise<void>(resolve => {
        eventEmitter.once('video.thumbnail.fallback', () => resolve());
      });

      await extractor.extract(timeoutVideo);
      await completion;

      expect(emitSpy).toHaveBeenCalledWith(
        timeoutVideo.id,
        expect.stringContaining('fallback'),
        'ffmpeg_timeout',
        expect.any(String),
      );
    });

    it('should emit video.thumbnail.fallback with appropriate reason on error', async () => {
      const codecVideo = { ...video, id: 'test-codec' };
      jest.spyOn(extractor, 'extractFrameFromUrl').mockRejectedValue(new Error('unsupported codec error'));
      const emitSpy = jest.spyOn(eventEmitter, 'emitThumbnailFallback');

      const completion = new Promise<void>(resolve => {
        eventEmitter.once('video.thumbnail.fallback', () => resolve());
      });

      await extractor.extract(codecVideo);
      await completion;

      expect(emitSpy).toHaveBeenCalledWith(
        codecVideo.id,
        expect.stringContaining('fallback'),
        'unsupported_codec',
        expect.any(String),
      );
    });

    it('should handle storage errors during fallback generation', async () => {
      const storageErrorVideo = { ...video, id: 'test-storage-error' };
      jest.spyOn(extractor, 'extractFrameFromUrl').mockResolvedValue(undefined);
      jest.spyOn(storageAdapter, 'upload').mockRejectedValue(new Error('storage upload failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Create a promise that resolves when console.error is called
      const errorLogged = new Promise<void>(resolve => {
        consoleSpy.mockImplementation((message) => {
          if (message === 'Failed to generate fallback thumbnail') {
            resolve();
          }
        });
      });

      await extractor.extract(storageErrorVideo);

      // Wait for the error to be logged (or timeout)
      await Promise.race([
        errorLogged,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for console.error')), 1000))
      ]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate fallback thumbnail'),
        expect.objectContaining({ error: 'storage upload failed' }),
      );

      consoleSpy.mockRestore();
    });

    it('should map various errors to correct reasons', async () => {
      const scenarios = [
        { error: 'corrupt file', expected: 'corrupted_file' },
        { error: 'invalid format', expected: 'corrupted_file' },
        { error: 'network error', expected: 'network_error' },
        { error: 'ECONNREFUSED', expected: 'network_error' },
        { error: 'storage error', expected: 'storage_error' },
        { error: 'upload failed', expected: 'storage_error' },
        { error: 'timeout occurred', expected: 'ffmpeg_timeout' },
        { error: 'something else', expected: 'ffmpeg_timeout' },
      ];

      for (const scenario of scenarios) {
        const scenarioVideo = { ...video, id: `test-scenario-${scenario.expected}-${Math.random()}` };
        jest.spyOn(extractor, 'extractFrameFromUrl').mockRejectedValue(new Error(scenario.error));
        const emitSpy = jest.spyOn(eventEmitter, 'emitThumbnailFallback');

        const completion = new Promise<void>(resolve => {
          eventEmitter.once('video.thumbnail.fallback', () => resolve());
        });

        await extractor.extract(scenarioVideo);
        await completion;

        expect(emitSpy).toHaveBeenCalledWith(
          scenarioVideo.id,
          expect.any(String),
          scenario.expected,
          expect.any(String),
        );
        emitSpy.mockRestore();
      }
    });

    it('should handle non-Error types in getErrorReason', async () => {
      const nonErrorVideo = { ...video, id: 'test-non-error' };
      jest.spyOn(extractor, 'extractFrameFromUrl').mockRejectedValue('simple string error');
      const emitSpy = jest.spyOn(eventEmitter, 'emitThumbnailFallback');

      const completion = new Promise<void>(resolve => {
        eventEmitter.once('video.thumbnail.fallback', () => resolve());
      });

      await extractor.extract(nonErrorVideo);
      await completion;

      expect(emitSpy).toHaveBeenCalledWith(
        nonErrorVideo.id,
        expect.any(String),
        'ffmpeg_timeout',
        expect.any(String),
      );
    });

    it('should skip extraction if already in progress', async () => {
      let resolveFirst: (val: Buffer) => void = () => {};
      const firstExtraction = new Promise<Buffer>(resolve => {
        resolveFirst = resolve;
      });

      jest.spyOn(extractor, 'extractFrameFromUrl').mockReturnValue(firstExtraction);

      const infoSpy = jest.spyOn(console, 'info').mockImplementation();

      // Start first extraction
      extractor.extract(video);

      // Give it a tiny bit of time to start and set the flag
      await new Promise(resolve => setImmediate(resolve));

      // Start second extraction immediately
      await extractor.extract(video);

      await new Promise(resolve => setImmediate(resolve));

      expect(infoSpy).toHaveBeenCalledWith(
        'Thumbnail extraction already in progress',
        expect.objectContaining({ videoId: video.id })
      );

      // Finish first extraction to cleanup
      resolveFirst(Buffer.from('ok'));
      await new Promise(resolve => setImmediate(resolve));

      infoSpy.mockRestore();
    });
  });
});

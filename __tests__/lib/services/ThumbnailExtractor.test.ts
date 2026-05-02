import { ThumbnailExtractor } from '@/lib/services/ThumbnailExtractor';
import { IStorageAdapter } from '@/lib/storage';
import { Video } from '@/types';
import { VideoEventEmitter } from '@/lib/VideoEventEmitter';

class MockStorageAdapter implements IStorageAdapter {
  async upload(file: Buffer, key: string, contentType: string, checksumSHA256?: string) {
    return `s3://bucket/${key}`;
  }

  async getUploadPresignedUrl(key: string, contentType: string, expiresIn?: number) {
    return `https://mock-storage.example.com/${key}?signature=...`;
  }

  async initiateMultipartUpload(key: string, contentType: string) {
    return 'upload-id-123';
  }

  async uploadPart(chunk: Buffer, key: string, uploadId: string, partNumber: number, checksumSHA256?: string) {
    return 'etag-123';
  }

  async getUploadPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresIn?: number) {
    return `https://mock-storage.example.com/${key}?partNumber=${partNumber}&signature=...`;
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
    return 'https://mock-storage.example.com/video';
  }

  async delete(key: string) {
    // No return value (Promise<void>)
  }

  async getSignedUrl(key: string, expiresIn?: number) {
    return `https://mock-storage.example.com/${key}?signature=...`;
  }

  async exists(key: string) {
    return true;
  }

  async listObjects(prefix?: string) {
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

  describe('generateFallbackImage', () => {
    it('should generate a buffer for fallback', async () => {
      const video: Video = {
        id: 'test-video-fallback-gen',
        filename: 'sample.mp4',
        originalName: 'Sample.mp4',
        title: 'Sample Video',
        size: 1000000,
        status: 'uploading',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const buffer = await extractor.generateFallbackImage(video);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});

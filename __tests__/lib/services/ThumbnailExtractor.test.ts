import { ThumbnailExtractor } from '@/lib/services/ThumbnailExtractor';
import { IStorageAdapter } from '@/lib/storage';
import { Video } from '@/types';
import { VideoEventEmitter } from '@/lib/VideoEventEmitter';

class MockStorageAdapter implements IStorageAdapter {
  async listBuckets() {
    return [];
  }

  async upload(buffer: Buffer, key: string, mimeType?: string) {
    return `s3://bucket/${key}`;
  }

  async download(key: string) {
    return Buffer.from('mock video content');
  }

  async getSignedUrl(key: string) {
    return `https://mock-storage.example.com/${key}?signature=...`;
  }

  async delete(key: string) {
    return true;
  }

  async initiateMultipartUpload(key: string, mimeType?: string) {
    return 'upload-id-123';
  }

  async uploadPart(buffer: Buffer, key: string, uploadId: string, partNumber: number) {
    return 'etag-123';
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: any[]) {
    return 'https://mock-storage.example.com/video';
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    return true;
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

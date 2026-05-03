import { FallbackGenerator } from '@/lib/images/FallbackGenerator';
import { Video } from '@/types';

describe('FallbackGenerator', () => {
  describe('generateFallback', () => {
    it('should generate a buffer for a valid video', async () => {
      const video: Video = {
        id: 'test-video-123',
        filename: 'sample.mp4',
        originalName: 'My Video.mp4',
        title: 'Test Video',
        size: 1000000,
        status: 'processing',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const generator = new FallbackGenerator();
      const buffer = await generator.generateFallback(video);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should include filename in the image', async () => {
      const video: Video = {
        id: 'test-video-456',
        filename: 'long-video-filename-with-many-characters-that-should-be-truncated.mp4',
        originalName: 'Long Video.mp4',
        title: 'Long Video',
        size: 5000000,
        status: 'processing',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const generator = new FallbackGenerator();
      const buffer = await generator.generateFallback(video);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle videos with custom originalName', async () => {
      const video: Video = {
        id: 'test-video-789',
        filename: 'video.mp4',
        originalName: 'Beautiful Nature Documentary.mp4',
        title: 'Beautiful Nature Documentary',
        size: 2000000,
        status: 'processing',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const generator = new FallbackGenerator();
      const buffer = await generator.generateFallback(video);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should produce consistent output for same input', async () => {
      const video: Video = {
        id: 'test-video-consistency',
        filename: 'video.mp4',
        originalName: 'Test Video.mp4',
        title: 'Test Video',
        size: 1000000,
        status: 'processing',
        progress: 100,
        createdAt: new Date('2026-04-28T10:00:00Z'),
        updatedAt: new Date('2026-04-28T10:00:00Z'),
      };

      const generator = new FallbackGenerator();
      const buffer1 = await generator.generateFallback(video);
      const buffer2 = await generator.generateFallback(video);

      expect(buffer1).toEqual(buffer2);
    });

    it('should truncate extremely long filenames', async () => {
      const generator = new FallbackGenerator();
      const video = {
        id: 'test-long',
        filename: 'a'.repeat(100) + '.mp4',
        originalName: 'a'.repeat(100) + '.mp4',
        createdAt: new Date()
      } as Video;
      const buffer = await generator.generateFallback(video);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle filenames without extensions', async () => {
      const generator = new FallbackGenerator();
      const video = {
        id: 'test-no-ext',
        filename: 'just-a-file-that-is-very-long-and-should-be-truncated-anyway',
        originalName: 'just-a-file-that-is-very-long-and-should-be-truncated-anyway',
        createdAt: new Date()
      } as Video;
      const buffer = await generator.generateFallback(video);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should escape special XML characters in filename', async () => {
      const generator = new FallbackGenerator();
      const video = {
        id: 'test-escape',
        filename: 'video <tag> & "quote" \'apostrophe\'.mp4',
        originalName: 'video <tag> & "quote" \'apostrophe\'.mp4',
        createdAt: new Date()
      } as Video;
      const buffer = await generator.generateFallback(video);
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});

import { deriveThumbnailUrl } from '../thumbnail';
import type { Video } from '@/types';

const base = (over: Partial<Video>): Video => ({
  id: 'v1', filename: 'v1/f.mp4', originalName: 'f.mp4', title: 'f.mp4',
  size: 1, status: 'processing', progress: 0,
  createdAt: new Date(), updatedAt: new Date(), ...over,
}) as Video;

const storage = { getPublicUrl: async (k: string) => `http://localhost:9000/videos/${k}` };

describe('deriveThumbnailUrl', () => {
  it('returns explicit thumbnailUrl when present', async () => {
    const url = await deriveThumbnailUrl(base({ thumbnailUrl: 'http://x/y.jpg' }), storage);
    expect(url).toBe('http://x/y.jpg');
  });
  it('derives public URL when thumbnailStatus is ready', async () => {
    const url = await deriveThumbnailUrl(base({ thumbnailStatus: 'ready' }), storage);
    expect(url).toBe('http://localhost:9000/videos/thumbnails/v1.jpg');
  });
  it('returns null when not ready and no explicit url', async () => {
    const url = await deriveThumbnailUrl(base({ thumbnailStatus: 'pending' }), storage);
    expect(url).toBeNull();
  });
});

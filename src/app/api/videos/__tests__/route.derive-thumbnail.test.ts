import { deriveThumbnailUrl } from '../thumbnail';
import type { Video } from '@/types';

const base = (over: Partial<Video>): Video => ({
  id: 'v1', filename: 'v1/f.mp4', originalName: 'f.mp4', title: 'f.mp4',
  size: 1, status: 'processing', progress: 0,
  createdAt: new Date(), updatedAt: new Date(), ...over,
}) as Video;

describe('deriveThumbnailUrl', () => {
  it('returns the same-origin proxy URL when an explicit thumbnailUrl is present', async () => {
    // The stored URL points at the browser-facing MinIO host; we must NOT hand it
    // to next/image (the server-side optimizer cannot resolve it). Always proxy.
    const url = await deriveThumbnailUrl(base({ thumbnailUrl: 'http://localhost:9000/videos/thumbnails/v1.jpg' }));
    expect(url).toBe('/api/videos/v1/thumbnail');
  });

  it('returns the same-origin proxy URL when thumbnailStatus is ready', async () => {
    const url = await deriveThumbnailUrl(base({ thumbnailStatus: 'ready' }));
    expect(url).toBe('/api/videos/v1/thumbnail');
  });

  it('returns the same-origin proxy URL when thumbnailStatus is failed (fallback image)', async () => {
    const url = await deriveThumbnailUrl(base({ thumbnailStatus: 'failed' }));
    expect(url).toBe('/api/videos/v1/thumbnail');
  });

  it('returns null when not ready and no explicit url', async () => {
    const url = await deriveThumbnailUrl(base({ thumbnailStatus: 'pending' }));
    expect(url).toBeNull();
  });
});

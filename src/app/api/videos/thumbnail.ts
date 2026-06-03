import type { Video } from '@/types';

interface PublicUrlSource {
  getPublicUrl(key: string): Promise<string>;
}

export async function deriveThumbnailUrl(
  video: Pick<Video, 'id' | 'thumbnailUrl' | 'thumbnailStatus'>,
  storage: PublicUrlSource,
): Promise<string | null> {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.thumbnailStatus === 'ready') {
    return storage.getPublicUrl(`thumbnails/${video.id}.jpg`);
  }
  return null;
}

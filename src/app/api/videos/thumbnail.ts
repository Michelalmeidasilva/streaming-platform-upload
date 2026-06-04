import type { Video } from '@/types';

/**
 * Resolves the thumbnail URL handed to the client. We never expose the raw
 * object-storage URL: in Docker the stored URL uses the browser-facing MinIO
 * host (localhost:9000), which the server-side next/image optimizer cannot
 * resolve from inside the container. Instead we return a same-origin proxy
 * (`/api/videos/:id/thumbnail`) that streams the object via the internal
 * endpoint. Returns null when no thumbnail is available yet so the UI can fall
 * back to its placeholder.
 */
export async function deriveThumbnailUrl(
  video: Pick<Video, 'id' | 'thumbnailUrl' | 'thumbnailStatus'>,
): Promise<string | null> {
  const hasThumbnail =
    Boolean(video.thumbnailUrl) ||
    video.thumbnailStatus === 'ready' ||
    video.thumbnailStatus === 'failed';

  return hasThumbnail ? `/api/videos/${video.id}/thumbnail` : null;
}

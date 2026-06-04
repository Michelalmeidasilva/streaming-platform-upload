import { NextRequest, NextResponse } from 'next/server';
import { uploadService, storageAdapter } from '@/lib/api/uploadService';

export const dynamic = 'force-dynamic';

/**
 * Same-origin thumbnail proxy. The browser (and the next/image optimizer, which
 * fetches server-side from inside the container) loads `/api/videos/:id/thumbnail`,
 * and we stream the object from MinIO/S3 using the INTERNAL endpoint via a signed
 * URL. This avoids the dual-host trap where the stored thumbnail URL points at the
 * browser-facing host (localhost:9000) that the container cannot resolve.
 *
 * Intentionally unauthenticated: the object-storage bucket is already public-read
 * for thumbnails, and the next/image optimizer does not forward the user session.
 * Only well-known keys (`thumbnails/{videoId}.jpg`) for an existing video are served.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const video = await uploadService.getVideo(params.videoId);
  if (!video) {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
  }

  const key =
    video.thumbnailStatus === 'failed'
      ? `thumbnails/${video.id}-fallback.jpg`
      : `thumbnails/${video.id}.jpg`;

  let upstream: Response;
  try {
    const signedUrl = await storageAdapter.getSignedUrl(key);
    upstream = await fetch(signedUrl);
  } catch {
    return NextResponse.json({ error: 'Thumbnail unavailable' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

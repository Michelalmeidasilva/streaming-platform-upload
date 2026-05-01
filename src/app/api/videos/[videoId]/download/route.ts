import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { canDownloadVideo } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session';
import { recordSecurityEvent } from '@/lib/security/audit';

function toAttachmentFilename(filename: string) {
  return filename.replace(/[/\\"]/g, '_');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getCurrentSession();
  if (!session) {
    recordSecurityEvent({
      type: 'access_denied',
      route: `/api/videos/${params.videoId}/download`,
      method: 'GET',
      reason: 'missing_session',
      status: 401,
      email: null,
      role: null,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canDownloadVideo(session.user.role)) {
    recordSecurityEvent({
      type: 'access_denied',
      route: `/api/videos/${params.videoId}/download`,
      method: 'GET',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const video = uploadService.getVideo(params.videoId);
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const targetUrl = video.url || video.downloadUrl;
  if (!targetUrl) {
    return NextResponse.json({ error: 'Download unavailable' }, { status: 503 });
  }

  const upstreamResponse = await fetch(new URL(targetUrl, _request.url));
  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return NextResponse.json({ error: 'Download unavailable' }, { status: 503 });
  }

  return new NextResponse(upstreamResponse.body, {
    status: 200,
    headers: {
      'Content-Type': upstreamResponse.headers.get('content-type') || 'application/octet-stream',
      'Content-Length': upstreamResponse.headers.get('content-length') || '',
      'Content-Disposition': `attachment; filename="${toAttachmentFilename(video.originalName)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

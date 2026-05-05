import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { canDeleteVideo, canEditVideo } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session';
import { recordSecurityEvent } from '@/lib/security/audit';
import type { Video as VideoModel } from '@/types';

function toVideoDto(video: VideoModel) {
  return {
    id: video.id,
    title: video.title || video.originalName,
    originalName: video.originalName,
    size: video.size,
    status: video.status,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    downloadUrl: `/api/videos/${video.id}/download`,
    thumbnailUrl: video.thumbnailUrl || null,
    thumbnailStatus: video.thumbnailStatus || 'pending',
  };
}

async function getAuthorizedSession(route: string, method: string) {
  const session = await getCurrentSession();
  if (!session) {
    recordSecurityEvent({
      type: 'access_denied',
      route,
      method,
      reason: 'missing_session',
      status: 401,
      email: null,
      role: null,
    });
    return null;
  }

  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getAuthorizedSession(`/api/videos/${params.videoId}`, 'GET');
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const video = await uploadService.getVideo(params.videoId);
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  return NextResponse.json({ video: toVideoDto(video) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getAuthorizedSession(`/api/videos/${params.videoId}`, 'PATCH');
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canEditVideo(session.user.role)) {
    recordSecurityEvent({
      type: 'access_denied',
      route: `/api/videos/${params.videoId}`,
      method: 'PATCH',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const updated = await uploadService.updateVideoTitle(params.videoId, title);
  if (!updated) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  return NextResponse.json({ video: toVideoDto(updated) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getAuthorizedSession(`/api/videos/${params.videoId}`, 'DELETE');
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canDeleteVideo(session.user.role)) {
    recordSecurityEvent({
      type: 'access_denied',
      route: `/api/videos/${params.videoId}`,
      method: 'DELETE',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const video = await uploadService.getVideo(params.videoId);
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  await uploadService.deleteVideo(params.videoId);
  return NextResponse.json({ success: true });
}

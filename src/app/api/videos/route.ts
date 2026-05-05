import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import type { Video as VideoModel } from '@/types';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    recordSecurityEvent({
      type: 'access_denied',
      route: '/api/videos',
      method: 'GET',
      reason: 'missing_session',
      status: 401,
      email: null,
      role: null,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canSearchVideos(session.user.role)) {
    recordSecurityEvent({
      type: 'access_denied',
      route: '/api/videos',
      method: 'GET',
      reason: 'insufficient_role',
      status: 403,
      email: session.user.email || null,
      role: session.user.role,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim().toLowerCase();
  const videos = (await uploadService.getAllVideos(query || undefined)).map(toVideoDto);

  return NextResponse.json({ videos });
}

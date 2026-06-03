import { NextRequest, NextResponse } from 'next/server';
import { uploadService, storageAdapter } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import type { Video as VideoModel } from '@/types';
import { withMetrics } from '@/lib/metrics';
import { deriveThumbnailUrl } from './thumbnail';

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

async function getHandler(request: NextRequest) {
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
  const videos = await uploadService.getAllVideos(query || undefined);
  const dtos = await Promise.all(
    videos.map(async (video) => ({
      ...toVideoDto(video),
      thumbnailUrl: await deriveThumbnailUrl(video, storageAdapter),
    })),
  );

  return NextResponse.json({ videos: dtos });
}

export const GET = withMetrics('/api/videos', getHandler);

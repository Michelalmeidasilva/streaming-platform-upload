import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { canUploadVideo } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session';
import { recordSecurityEvent } from '@/lib/security/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      recordSecurityEvent({
        type: 'access_denied',
        route: '/api/upload/complete',
        method: 'POST',
        reason: 'missing_session',
        status: 401,
        email: null,
        role: null,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canUploadVideo(session.user.role)) {
      recordSecurityEvent({
        type: 'access_denied',
        route: '/api/upload/complete',
        method: 'POST',
        reason: 'insufficient_role',
        status: 403,
        email: session.user.email || null,
        role: session.user.role,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sessionId, etags, thumbnail } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const video = await uploadService.completeUpload(sessionId, etags || [], thumbnail);

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        filename: video.originalName,
        size: video.size,
        status: video.status,
        downloadUrl: `/api/videos/${video.id}/download`,
        thumbnailUrl: video.thumbnailUrl || null,
        thumbnailStatus: video.thumbnailStatus || 'pending',
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      },
    });
  } catch (error) {
    console.error('Complete upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Invalid session' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

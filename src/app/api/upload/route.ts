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
        route: '/api/upload',
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
        route: '/api/upload',
        method: 'POST',
        reason: 'insufficient_role',
        status: 403,
        email: session.user.email || null,
        role: session.user.role,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { filename, size, mimeType } = await request.json();

    if (!filename || !size) {
      return NextResponse.json({ error: 'filename and size are required' }, { status: 400 });
    }

    const { sessionId, videoId, chunkSize, totalChunks, presignedUrls } = await uploadService.initiateUpload(
      filename,
      size,
      mimeType,
    );

    return NextResponse.json({ sessionId, videoId, chunkSize, totalChunks, presignedUrls });
  } catch (error) {
    console.error('Initiate upload error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

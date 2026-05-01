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
        route: '/api/upload/chunk',
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
        route: '/api/upload/chunk',
        method: 'POST',
        reason: 'insufficient_role',
        status: 403,
        email: session.user.email || null,
        role: session.user.role,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const chunkIndexParam = request.nextUrl.searchParams.get('chunkIndex');
    const chunkIndex = Number.parseInt(chunkIndexParam || '', 10);

    if (!sessionId || !Number.isFinite(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: 'sessionId and chunkIndex are required' }, { status: 400 });
    }

    const chunk = Buffer.from(await request.arrayBuffer());
    await uploadService.uploadChunk(sessionId, chunkIndex, chunk);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chunk upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Invalid session' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

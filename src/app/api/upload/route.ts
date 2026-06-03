import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { canUploadVideo } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withMetrics } from '@/lib/metrics';

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.m3u8']);
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-m4v',
  'video/webm', 'application/x-mpegurl', 'application/vnd.apple.mpegurl',
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

function validateUploadRequest(filename: string, size: number, mimeType?: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return 'Unsupported file format';
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) return 'Unsupported MIME type';
  if (size > MAX_FILE_SIZE) return 'File exceeds maximum allowed size of 5 GB';
  return null;
}

async function postHandler(request: NextRequest) {
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

    const validationError = validateUploadRequest(filename, size, mimeType);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { sessionId, videoId, chunkSize, totalChunks, presignedUrls } = await uploadService.initiateUpload(
      filename,
      size,
      mimeType,
    );

    return NextResponse.json({ sessionId, videoId, chunkSize, totalChunks, presignedUrls });
  } catch (error) {
    console.error('Initiate upload error:', error);
    return NextResponse.json({ error: 'Failed to initiate upload' }, { status: 500 });
  }
}

export const POST = withMetrics('/api/upload', postHandler);

import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { canUploadVideo } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withMetrics } from '@/lib/metrics';
import type { RawVideoParams } from '@/lib/events';

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.y4m', '.yuv', '.m3u8']);
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/x-matroska',
  'video/webm', 'application/x-mpegurl', 'application/vnd.apple.mpegurl',
]);
// Headerless / uncommon raw formats have no canonical MIME; browsers send an
// empty type or application/octet-stream, so MIME is not enforced for them.
const NO_CANONICAL_MIME_EXTENSIONS = new Set(['.y4m', '.yuv']);
// Headerless raw streams carry no geometry; it must be supplied as rawVideo.
const RAW_VIDEO_EXTENSIONS = new Set(['.yuv']);
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

function fileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function validateUploadRequest(
  filename: string,
  size: number,
  mimeType?: string,
  rawVideo?: RawVideoParams,
) {
  const ext = fileExtension(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) return 'Unsupported file format';
  if (mimeType && !NO_CANONICAL_MIME_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return 'Unsupported MIME type';
  }
  if (size > MAX_FILE_SIZE) return 'File exceeds maximum allowed size of 5 GB';
  if (RAW_VIDEO_EXTENSIONS.has(ext)) {
    if (!rawVideo || !(rawVideo.width > 0) || !(rawVideo.height > 0) || !(rawVideo.fps > 0)) {
      return 'Raw .yuv uploads require width, height and fps metadata';
    }
  }
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

    const { filename, size, mimeType, rawVideo, subtitles } = await request.json();

    if (!filename || !size) {
      return NextResponse.json({ error: 'filename and size are required' }, { status: 400 });
    }

    const validationError = validateUploadRequest(filename, size, mimeType, rawVideo);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { sessionId, videoId, chunkSize, totalChunks, presignedUrls, subtitleUploads } =
      await uploadService.initiateUpload(filename, size, mimeType, rawVideo, subtitles);

    return NextResponse.json({ sessionId, videoId, chunkSize, totalChunks, presignedUrls, subtitleUploads });
  } catch (error) {
    console.error('Initiate upload error:', error);
    return NextResponse.json({ error: 'Failed to initiate upload' }, { status: 500 });
  }
}

export const POST = withMetrics('/api/upload', postHandler);

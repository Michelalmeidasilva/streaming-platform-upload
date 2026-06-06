import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { canUploadVideo } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session';
import { recordSecurityEvent } from '@/lib/security/audit';
import { withEmf } from '@/lib/telemetry/emf';
import { getMaxFileSizeBytes, getMaxFileSizeGB } from '@/lib/uploadLimits';
import type { RawVideoParams } from '@/lib/events';

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.y4m', '.yuv', '.m3u8']);
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/x-matroska',
  'video/webm', 'application/x-mpegurl', 'application/vnd.apple.mpegurl',
]);
// Extensions whose browser-reported MIME type is unreliable, so MIME is not
// enforced for them — the ALLOWED_EXTENSIONS allow-list above is the real gate:
//  - .y4m/.yuv: headerless raw formats with no canonical MIME; browsers send an
//    empty type or application/octet-stream.
//  - .mkv: Matroska's MIME varies across browsers/OSes (Safari sends
//    video/matroska, others video/x-matroska, application/x-matroska, video/mkv,
//    or empty), so a strict allow-list rejects legitimate files with
//    "Unsupported MIME type".
const NO_CANONICAL_MIME_EXTENSIONS = new Set(['.y4m', '.yuv', '.mkv']);
// Headerless raw streams carry no geometry; it must be supplied as rawVideo.
const RAW_VIDEO_EXTENSIONS = new Set(['.yuv']);

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
  if (size > getMaxFileSizeBytes()) {
    return `File exceeds maximum allowed size of ${getMaxFileSizeGB()} GB`;
  }
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

export const POST = withEmf('/api/upload', postHandler);

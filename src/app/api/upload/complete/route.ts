import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, etags, thumbnail } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const video = await uploadService.completeUpload(sessionId, etags || [], thumbnail);

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        filename: video.originalName,
        size: video.size,
        status: video.status,
        url: video.url,
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

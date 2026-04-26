import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';

export async function POST(request: NextRequest) {
  try {
    const { filename, size, mimeType } = await request.json();

    if (!filename || !size) {
      return NextResponse.json({ error: 'filename and size are required' }, { status: 400 });
    }

    const { sessionId, videoId, chunkSize, totalChunks } = await uploadService.initiateUpload(
      filename,
      size,
      mimeType,
    );

    return NextResponse.json({ sessionId, videoId, chunkSize, totalChunks });
  } catch (error) {
    console.error('Initiate upload error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

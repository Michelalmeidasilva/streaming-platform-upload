import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const chunkIndexRaw = formData.get('chunkIndex') as string;
    const chunk = formData.get('chunk') as File | null;

    if (!sessionId || chunkIndexRaw === null || !chunk) {
      return NextResponse.json(
        { error: 'sessionId, chunkIndex and chunk are required' },
        { status: 400 },
      );
    }

    const chunkIndex = parseInt(chunkIndexRaw, 10);
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: 'chunkIndex must be a non-negative integer' }, { status: 400 });
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());
    await uploadService.uploadChunk(sessionId, chunkIndex, buffer);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Chunk upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Invalid session' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

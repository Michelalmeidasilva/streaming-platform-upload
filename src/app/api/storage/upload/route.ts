import { NextRequest, NextResponse } from 'next/server';
import { resolveMemoryUploadTarget, storeMemoryUpload } from '@/lib/storage/MemoryAdapter';

export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
  }

  const target = resolveMemoryUploadTarget(token);
  if (!target) {
    return NextResponse.json({ error: 'Invalid upload token' }, { status: 404 });
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  const etag = storeMemoryUpload(target, buffer, request.headers.get('content-type') || undefined);

  return new NextResponse(null, {
    status: 200,
    headers: {
      ETag: `"${etag}"`,
    },
  });
}

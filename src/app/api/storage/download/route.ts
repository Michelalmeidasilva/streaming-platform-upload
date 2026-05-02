import { NextRequest, NextResponse } from 'next/server';
import { readMemoryObject, resolveMemoryDownloadTarget } from '@/lib/storage/MemoryAdapter';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing download token' }, { status: 400 });
  }

  const target = resolveMemoryDownloadTarget(token);
  if (!target) {
    return NextResponse.json({ error: 'Invalid download token' }, { status: 404 });
  }

  const object = readMemoryObject(target.key);
  if (!object) {
    return NextResponse.json({ error: 'Object not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.body), {
    status: 200,
    headers: {
      'Content-Type': object.contentType,
      'Content-Length': String(object.body.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}

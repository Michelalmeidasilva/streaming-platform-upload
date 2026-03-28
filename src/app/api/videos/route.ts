import { NextResponse } from 'next/server';
import { createStorageAdapter } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const storage = createStorageAdapter({
  provider: process.env.STORAGE_PROVIDER as 's3' | 'minio' || 'minio',
  bucket: process.env.STORAGE_BUCKET || 'videos',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export async function GET() {
  try {
    const objects = await storage.listObjects();

    // Group objects by videoId (key format: "{videoId}/{filename}")
    const videoMap = new Map<string, { originalName: string; size: number; lastModified: Date }>();

    for (const obj of objects) {
      const parts = obj.key.split('/');
      if (parts.length < 2) continue;

      const videoId = parts[0];
      const filename = parts.slice(1).join('/');

      const existing = videoMap.get(videoId);
      if (!existing || obj.lastModified > existing.lastModified) {
        videoMap.set(videoId, {
          originalName: filename,
          size: existing ? existing.size + obj.size : obj.size,
          lastModified: obj.lastModified,
        });
      } else if (existing) {
        existing.size += obj.size;
      }
    }

    const videos = Array.from(videoMap.entries()).map(([id, data]) => ({
      id,
      originalName: data.originalName,
      size: data.size,
      status: 'ready',
      createdAt: data.lastModified.toISOString(),
    }));

    // Sort newest first
    videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

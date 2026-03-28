import { NextRequest, NextResponse } from 'next/server';
import { createStorageAdapter } from '@/lib/storage';
import { UploadService } from '@/lib/services/UploadService';

const storage = createStorageAdapter({
  provider: process.env.STORAGE_PROVIDER as 's3' | 'minio' || 'minio',
  bucket: process.env.STORAGE_BUCKET || 'videos',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const uploadService = new UploadService(storage);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const { sessionId, videoId, chunkSize } = await uploadService.initiateUpload(
      file.name,
      file.size,
      file.type
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await uploadService.uploadChunk(sessionId, 0, buffer);
    const video = await uploadService.completeUpload(sessionId);

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        filename: video.originalName,
        size: video.size,
        status: video.status,
        url: video.url,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

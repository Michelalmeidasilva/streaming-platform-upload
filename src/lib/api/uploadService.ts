import { createStorageAdapter } from '@/lib/storage';
import { UploadService } from '@/lib/services/UploadService';
import { initializeEventDispatcher } from '@/lib/events/EventDispatcher';

initializeEventDispatcher();

const storage = createStorageAdapter({
  provider: process.env.STORAGE_PROVIDER as 's3' | 'minio' || 'minio',
  bucket: process.env.STORAGE_BUCKET || 'videos',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export const uploadService = new UploadService(storage);

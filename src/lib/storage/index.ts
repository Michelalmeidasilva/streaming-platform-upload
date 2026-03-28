import { IStorageAdapter } from './IStorageAdapter';
import { S3Adapter } from './S3Adapter';
import { MinIOAdapter } from './MinIOAdapter';
import { StorageConfig } from '@/types';

export function createStorageAdapter(config: StorageConfig): IStorageAdapter {
  switch (config.provider) {
    case 's3':
      return new S3Adapter(config);
    case 'minio':
      return new MinIOAdapter(config);
    default:
      throw new Error(`Unsupported storage provider: ${config.provider}`);
  }
}

export type { IStorageAdapter, UploadResult, StorageObject } from './IStorageAdapter';
export { S3Adapter } from './S3Adapter';
export { MinIOAdapter } from './MinIOAdapter';
